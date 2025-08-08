import { load } from "cheerio";
import fetch from "node-fetch";
import { ScrapedBlog, ContentSection, ScrapedContent, CloudflareKV } from "./types.js";

export class BlogScraper {
    constructor(private kvNamespace?: CloudflareKV) {}

    /**
     * Check if URL has already been scraped using Cloudflare KV
     */
    async isUrlScraped(url: string): Promise<boolean> {
        if (!this.kvNamespace) {
            console.log("⚠️  No KV namespace provided, skipping URL check");
            return false;
        }

        try {
            const key = `scraped:${this.createUrlKey(url)}`;
            const result = await this.kvNamespace.get(key);
            return result !== null;
        } catch (error) {
            console.error("❌ Error checking KV for URL:", error);
            return false;
        }
    }

    /**
     * Mark URL as scraped in Cloudflare KV
     */
    async markUrlAsScraped(url: string, blogData: ScrapedBlog): Promise<void> {
        if (!this.kvNamespace) {
            console.log("⚠️  No KV namespace provided, skipping URL storage");
            return;
        }

        try {
            const key = `scraped:${this.createUrlKey(url)}`;
            const value = JSON.stringify({
                url,
                title: blogData.title,
                scrapedDate: blogData.scrapedDate,
                category: blogData.category,
            });

            await this.kvNamespace.put(key, value);
            console.log("✅ Marked URL as scraped in KV:", url);
        } catch (error) {
            console.error("❌ Error storing URL in KV:", error);
        }
    }

    /**
     * Create a KV-friendly key from URL
     */
    private createUrlKey(url: string): string {
        return url.replace(/[^a-zA-Z0-9-_]/g, "_").substring(0, 512);
    }

    /**
     * Scrape PepperCloud blog post
     */
    async scrapePepperCloudBlog(blogUrl: string, category: string): Promise<ScrapedBlog | null> {
        try {
            const fullUrl = `https://blog.peppercloud.com${blogUrl}`;

            // Check KV first
            if (await this.isUrlScraped(fullUrl)) {
                console.log("🔄 URL already scraped (found in KV), skipping:", fullUrl);
                return null;
            }

            console.log("🔍 Scraping:", fullUrl);

            const response = await fetch(fullUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            const $ = load(html);

            // Extract title and description
            const title = $("h1.article-title.max-90").text().trim();
            const description = $("p.article-excerpt.max-90").text().trim();

            if (!title) {
                console.error("❌ No title found for:", fullUrl);
                return null;
            }

            // Extract content
            const blogContent = $("section.gh-content");
            if (blogContent.length === 0) {
                console.error("❌ No content found for:", fullUrl);
                return null;
            }

            const sections = this.extractSections(blogContent, $);
            const aiReadyContent = this.prepareForAI({ title, description, category, sections, url: blogUrl });

            const scrapedBlog: ScrapedBlog = {
                title,
                description,
                category,
                sections,
                url: blogUrl,
                sourceUrl: fullUrl,
                scrapedDate: new Date().toISOString(),
                wordCount: aiReadyContent.split(/\\s+/).length,
                sectionsCount: sections.length,
            };

            // Mark as scraped in KV
            await this.markUrlAsScraped(fullUrl, scrapedBlog);

            return scrapedBlog;
        } catch (error) {
            console.error("❌ Error scraping blog:", error);
            return null;
        }
    }

    /**
     * Extract content sections from the blog
     */
    private extractSections(blogContent: any, $: any): ContentSection[] {
        const sections: ContentSection[] = [];
        let currentSection: ContentSection = { type: "intro", content: [] };

        blogContent.find("p, h1, h2, h3, h4, h5, h6, ul, ol").each((_, element) => {
            const $element = $(element);
            const text = $element.text().trim();

            if (!text) return;

            const tagName = element.tagName.toLowerCase();

            if (tagName.startsWith("h")) {
                // New section with heading
                if (currentSection.content.length > 0) {
                    sections.push(currentSection);
                }

                const level = parseInt(tagName.charAt(1));
                currentSection = {
                    type: `section_h${level}`,
                    heading: text,
                    content: [],
                };
            } else {
                // Add content to current section
                if (tagName === "ul" || tagName === "ol") {
                    const listItems: string[] = [];
                    $element.find("li").each((_, li) => {
                        const itemText = $(li).text().trim();
                        if (itemText) listItems.push(itemText);
                    });

                    if (listItems.length > 0) {
                        currentSection.content.push({
                            type: "list",
                            items: listItems,
                        });
                    }
                } else {
                    currentSection.content.push({
                        type: "paragraph",
                        text: text,
                    });
                }
            }
        });

        // Don't forget the last section
        if (currentSection.content.length > 0) {
            sections.push(currentSection);
        }

        return sections;
    }

    /**
     * Prepare scraped data for AI processing
     */
    prepareForAI(scrapedData: {
        title: string;
        description?: string;
        category: string;
        sections: ContentSection[];
        url: string;
    }): string {
        const promptSections: string[] = [
            `Title: ${scrapedData.title}`,
            scrapedData.description ? `Description: ${scrapedData.description}` : "",
            `Category: ${scrapedData.category}`,
            "",
        ].filter(Boolean);

        for (const section of scrapedData.sections) {
            if (section.type === "intro") {
                promptSections.push("Introduction:");
                for (const content of section.content) {
                    if (content.type === "paragraph" && content.text) {
                        promptSections.push(`- ${content.text}`);
                    }
                }
            } else {
                // Section with heading
                if (section.heading) {
                    promptSections.push(`\\n${section.heading}`);
                }

                for (const content of section.content) {
                    if (content.type === "paragraph" && content.text) {
                        promptSections.push(`- ${content.text}`);
                    } else if (content.type === "list" && content.items) {
                        promptSections.push("List items:");
                        for (const item of content.items) {
                            promptSections.push(`  • ${item}`);
                        }
                    }
                }
            }
        }

        return promptSections.join("\\n");
    }

    /**
     * Get recent blog URLs from PepperCloud by category
     */
    async getRecentBlogUrls(category: string, weeksBack: number = 2): Promise<string[]> {
        try {
            const categoryUrl = `https://blog.peppercloud.com/tag/${category}/`;
            console.log(`🔍 Fetching recent blogs from: ${categoryUrl}`);

            const response = await fetch(categoryUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            const $ = load(html);

            const urls: string[] = [];
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - weeksBack * 7);

            $("article").each((_, article) => {
                const $article = $(article);

                // Check publication date
                const timeElement = $article.find("footer.post-card-meta time");
                const dateTime = timeElement.attr("datetime");

                if (dateTime) {
                    const pubDate = new Date(dateTime);
                    if (pubDate < cutoffDate) {
                        console.log(`⏭️  Blog post older than ${weeksBack} weeks, skipping.`);
                        return false; // Break the loop
                    }
                }

                // Get blog URL
                const linkElement = $article.find("a.post-card-image-link");
                const blogUrl = linkElement.attr("href");

                if (blogUrl) {
                    urls.push(blogUrl);
                }
            });

            console.log(`📋 Found ${urls.length} recent blog URLs for category: ${category}`);
            return urls;
        } catch (error) {
            console.error(`❌ Error fetching blog URLs for category ${category}:`, error);
            return [];
        }
    }
}
