import { BlogScraper } from "./scraper.js";
import { BlogGenerator } from "./generator.js";
import type { CloudflareKV } from "./types.js";

// Mock Cloudflare KV for local development
class MockKV implements CloudflareKV {
    private storage = new Map<string, string>();

    async get(key: string): Promise<string | null> {
        return this.storage.get(key) || null;
    }

    async put(key: string, value: string): Promise<void> {
        this.storage.set(key, value);
    }
}

/**
 * Main scraping and generation workflow
 */
async function main() {
    try {
        console.log("🚀 Starting TypeScript blog scraper and generator");

        // Environment setup
        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            throw new Error("OPENAI_API_KEY environment variable is required");
        }

        // Initialize services
        const mockKV = new MockKV(); // Replace with actual Cloudflare KV in production
        const scraper = new BlogScraper(mockKV);
        const generator = new BlogGenerator(openaiApiKey);

        // Categories to scrape
        const categories = ["sales-and-marketing", "crm", "product-update", "grant", "product-support"];

        let totalProcessed = 0;
        let totalGenerated = 0;

        for (const category of categories) {
            console.log(`\\n${"=".repeat(60)}`);
            console.log(`🔍 Processing category: ${category}`);
            console.log("=".repeat(60));

            try {
                // Get recent blog URLs for this category
                const blogUrls = await scraper.getRecentBlogUrls(category, 2);

                if (blogUrls.length === 0) {
                    console.log(`⚠️  No recent blogs found for category: ${category}`);
                    continue;
                }

                for (const blogUrl of blogUrls) {
                    try {
                        console.log(`\\n📄 Processing: ${blogUrl}`);

                        // Scrape the blog (includes KV check)
                        const scrapedBlog = await scraper.scrapePepperCloudBlog(blogUrl, category);

                        if (!scrapedBlog) {
                            console.log("⏭️  Skipping (already scraped or failed to scrape)");
                            continue;
                        }

                        totalProcessed++;

                        // Prepare content for AI
                        const aiContent = scraper.prepareForAI(scrapedBlog);

                        console.log(`✅ Scraped: ${scrapedBlog.title}`);
                        console.log(`   Words: ${scrapedBlog.wordCount}, Sections: ${scrapedBlog.sectionsCount}`);

                        // Generate new blog content
                        console.log("🤖 Generating new content with AI...");
                        const generatedContent = await generator.generateBlog(aiContent, {
                            title: scrapedBlog.title,
                            category: scrapedBlog.category,
                            description: scrapedBlog.description,
                        });

                        // Save generated blog
                        const cleanFilename = generator.cleanFilename(scrapedBlog.title);
                        const generatedBlog = generator.saveBlogToFile(generatedContent, cleanFilename, category);

                        totalGenerated++;

                        console.log(`✅ Generated: ${generatedBlog.title}`);
                        console.log(`   File: generated_blogs/${category}/${generatedBlog.filename}`);
                        console.log(`   Generated words: ${generatedBlog.wordCount}`);

                        // Small delay to avoid rate limiting
                        await new Promise((resolve) => setTimeout(resolve, 1000));
                    } catch (error) {
                        console.error(`❌ Error processing ${blogUrl}:`, error);
                    }
                }
            } catch (error) {
                console.error(`❌ Error processing category ${category}:`, error);
            }
        }

        console.log(`\\n${"=".repeat(60)}`);
        console.log("🎉 Workflow completed!");
        console.log(`📊 Summary:`);
        console.log(`   Blogs processed: ${totalProcessed}`);
        console.log(`   Blogs generated: ${totalGenerated}`);
        console.log("=".repeat(60));
    } catch (error) {
        console.error("❌ Fatal error:", error);
        process.exit(1);
    }
}

// Run the workflow
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
