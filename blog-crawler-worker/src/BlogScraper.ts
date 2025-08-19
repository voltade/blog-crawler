/**
 * BlogScraper - Handles scraping blog posts from PepperCloud using sitemap table
 */

import * as cheerio from 'cheerio';

export interface ContentSection {
	type: 'intro' | 'section_h1' | 'section_h2' | 'section_h3' | 'section_h4' | 'section_h5' | 'section_h6';
	heading?: string;
	content: Array<{
		type: 'paragraph' | 'list';
		text?: string;
		items?: string[];
	}>;
}

export interface BlogPost {
	url: string;
	lastmod: string;
	title?: string;
}

export interface ScrapedBlog {
	title: string;
	description: string;
	category: string;
	sections: ContentSection[];
	url: string;
	filename?: string;
	lastmod?: string;
}

export class BlogScraper {
	async getAllBlogPostsFromSitemap(): Promise<BlogPost[]> {
		try {
			console.log('🔍 Fetching sitemap from: https://blog.peppercloud.com/sitemap-posts.xml');
			const response = await fetch('https://blog.peppercloud.com/sitemap-posts.xml');
			const xmlContent = await response.text();

			const blogPosts = this.parseXMLSitemap(xmlContent);
			console.log(`📋 Found ${blogPosts.length} blog posts in sitemap`);
			return blogPosts;
		} catch (error) {
			console.error('❌ Error fetching sitemap:', error);
			return [];
		}
	}

	/**
	 * Parse XML sitemap directly (keeps full URLs for consistency)
	 */
	private parseXMLSitemap(xmlContent: string): BlogPost[] {
		const $ = cheerio.load(xmlContent, { xmlMode: true });
		const blogPosts: BlogPost[] = [];

		$('url').each((_, element) => {
			const $element = $(element);
			const loc = $element.find('loc').text().trim();
			const lastmod = $element.find('lastmod').text().trim();

			if (loc && lastmod) {
				blogPosts.push({
					url: loc,
					lastmod: lastmod,
				});
			}
		});

		return blogPosts;
	}

	async getRecentPosts(cutoffDate: Date): Promise<BlogPost[]> {
		const allPosts = await this.getAllBlogPostsFromSitemap();

		// Filter posts newer than cutoff date
		const recentPosts = allPosts.filter((post: BlogPost) => {
			const postDate = new Date(post.lastmod);
			return postDate > cutoffDate;
		});

		console.log(`📅 Found ${recentPosts.length} posts newer than ${cutoffDate.toISOString().split('T')[0]}`);
		return recentPosts;
	}

	async scrapeBlog(blogUrl: string, lastmod?: string): Promise<ScrapedBlog | null> {
		try {
			console.log(`🔍 Scraping: ${blogUrl}`);

			const response = await fetch(blogUrl);
			const html = await response.text();
			const $ = cheerio.load(html);

			const title = $('h1.article-title').text().trim();
			const description = $('p.article-excerpt').text().trim();

			if (!title) {
				console.log('❌ No title found');
				return null;
			}

			const blogContent = $('section.gh-content');
			if (!blogContent.length) {
				console.log('❌ No content found');
				return null;
			}

			const contentSections = this.parseContent($, blogContent);
			const wordCount = this.calculateWordCount(contentSections);
			const cleanFilename = this.generateCleanFilename(title);

			console.log(`✅ Scraped: ${title}`);
			console.log(`   Words: ${wordCount}, Sections: ${contentSections.length}`);
			console.log(`   Filename: ${cleanFilename}.md`);

			return {
				title,
				description,
				category: 'uncategorized', // Will be determined by OpenAI later
				sections: contentSections,
				url: blogUrl,
				filename: `${cleanFilename}.mdx`,
				lastmod,
			};
		} catch (error) {
			console.error(`❌ Error scraping ${blogUrl}:`, error);
			return null;
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private parseContent($: cheerio.CheerioAPI, blogContent: cheerio.Cheerio<any>): ContentSection[] {
		const contentSections: ContentSection[] = [];
		let currentSection: ContentSection = { type: 'intro', content: [] };

		blogContent.find('p, h1, h2, h3, h4, h5, h6, ul, ol').each((_, element) => {
			const $element = $(element);
			const elementText = $element.text().trim();

			if (!elementText) return;

			// Check if it's a heading element
			const tagName = element.name || element.tagName;
			if (tagName?.toLowerCase().startsWith('h')) {
				if (currentSection.content.length > 0) {
					contentSections.push(currentSection);
				}
				const level = tagName.toLowerCase() as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
				currentSection = {
					type: `section_${level}` as ContentSection['type'],
					heading: elementText,
					content: [],
				};
			} else {
				const lowerTagName = tagName?.toLowerCase();
				if (lowerTagName === 'ul' || lowerTagName === 'ol') {
					const listItems: string[] = [];
					$element.find('li').each((_, li) => {
						const itemText = $(li).text().trim();
						if (itemText) listItems.push(itemText);
					});
					currentSection.content.push({
						type: 'list',
						items: listItems,
					});
				} else {
					currentSection.content.push({
						type: 'paragraph',
						text: elementText,
					});
				}
			}
		});

		// Add the last section
		if (currentSection.content.length > 0) {
			contentSections.push(currentSection);
		}

		return contentSections;
	}

	private calculateWordCount(sections: ContentSection[]): number {
		const allText = sections
			.flatMap((section) =>
				section.content.flatMap((content) =>
					content.type === 'paragraph' ? [content.text || ''] : content.type === 'list' ? content.items || [] : []
				)
			)
			.join(' ');

		return allText.split(' ').length;
	}

	private generateCleanFilename(title: string): string {
		return title
			.toLowerCase()
			.replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
			.replace(/\s+/g, '-') // Replace spaces with hyphens
			.replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
			.replace(/^-|-$/g, '') // Remove leading/trailing hyphens
			.substring(0, 100); // Limit length to 100 characters
	}
}
