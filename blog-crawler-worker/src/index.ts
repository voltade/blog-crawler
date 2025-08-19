/**
 * Blog Crawler Worker - Scheduled scraping and AI generation
 * Runs daily to scrape PepperCloud blog posts and generate new content with AI
 */

import { BlogScraper, type BlogPost, type ScrapedBlog } from './BlogScraper';
import { BlogGenerator } from './BlogGenerator';
import { FileUtils, type DispatchResult } from './FileUtils';

interface PostData {
	filename: string;
	word_count: number;
	sections_count: number;
}

function createPostData(scrapedBlog: ScrapedBlog, sourceUrl: string): PostData {
	const wordCount = scrapedBlog.sections
		.flatMap((section) =>
			section.content.flatMap((content) =>
				content.type === 'paragraph' ? [content.text || ''] : content.type === 'list' ? content.items || [] : []
			)
		)
		.join(' ')
		.split(' ').length;

	return {
		filename: scrapedBlog.filename || 'untitled.md',
		word_count: wordCount,
		sections_count: scrapedBlog.sections.length,
	};
}

interface Env {
	BLOG_SCRAPED_URLS: KVNamespace;
	BLOG_GRAPHICS_BUCKET: R2Bucket; // R2 bucket for graphics storage
	MYBROWSER: Fetcher; // Browser Rendering API binding
	OPENAI_API_KEY: string;
	ENVIRONMENT: string;
	REPO_OWNER: string;
	REPO_NAME: string;
	GITHUB_TOKEN: string;
}

class BlogCrawlerWorker {
	private env: Env;
	private scraper: BlogScraper;
	private generator: BlogGenerator;
	private fileUtils: FileUtils;

	constructor(env: Env) {
		this.env = env;
		this.scraper = new BlogScraper();
		this.generator = new BlogGenerator(env.OPENAI_API_KEY);
		this.fileUtils = new FileUtils(
			env.BLOG_SCRAPED_URLS,
			env.REPO_OWNER,
			env.REPO_NAME,
			env.GITHUB_TOKEN,
			env.MYBROWSER,
			env.BLOG_GRAPHICS_BUCKET
		);
	}

	async run(): Promise<string[]> {
		const results: string[] = [];
		results.push('🚀 Starting Blog Crawler Worker...');

		try {
			// Get the last processed date from KV
			const lastProcessedDate = await this.fileUtils.getLastProcessedDate();
			results.push(`📅 Last processed date: ${lastProcessedDate.toISOString().split('T')[0]}`);

			// Get recent posts from sitemap
			const recentPosts = await this.scraper.getRecentPosts(lastProcessedDate);
			results.push(`📋 Found ${recentPosts.length} posts to process`);

			if (recentPosts.length === 0) {
				results.push('⚠️  No new posts to process');
				return results;
			}

			let latestDate = lastProcessedDate;
			let processedCount = 0;

			// Process each post
			for (const post of recentPosts) {
				const postResults = await this.processPost(post);
				results.push(...postResults);
				processedCount++;

				// Update latest date if this post is newer
				const postDate = new Date(post.lastmod);
				if (postDate > latestDate) {
					latestDate = postDate;
				}

				// Limit to avoid timeout (process max 5 posts per run)
				if (processedCount >= 5) {
					results.push('⏭️ Processed 5 posts, stopping to avoid timeout');
					break;
				}
			}

			// Update the last processed date in KV
			if (latestDate > lastProcessedDate) {
				await this.fileUtils.updateLastProcessedDate(latestDate);
				results.push(`✅ Updated last processed date to: ${latestDate.toISOString().split('T')[0]}`);
			}

			results.push(`🎉 Blog crawling completed! Processed ${processedCount} posts.`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			results.push(`❌ Error during crawling: ${errorMessage}`);
		}

		return results;
	}

	private async processPost(post: BlogPost): Promise<string[]> {
		const results: string[] = [];
		results.push(`\n📄 Processing: ${post.url} (${post.lastmod.split('T')[0]})`);

		try {
			// Scrape the blog (no need to check if processed - already filtered by date)
			const scrapedBlog = await this.scraper.scrapeBlog(post.url, post.lastmod);
			if (!scrapedBlog) {
				results.push('❌ Failed to scrape blog content');
				return results;
			}

			// Create post data for tracking
			const postData = createPostData(scrapedBlog, post.url);
			results.push(`📋 Created post data: ${postData.filename} (Category: ${scrapedBlog.category})`);
			results.push(`   Word count: ${postData.word_count}, Sections: ${postData.sections_count}`);

			// Generate AI content
			const generatedResult = await this.generator.generateBlogWithAI(scrapedBlog);
			if (generatedResult) {
				// Update the scraped blog with AI-chosen category
				scrapedBlog.category = generatedResult.category;

				results.push(`🤖 Generated AI content for: ${scrapedBlog.title}`);
				results.push(`🏷️  AI chose category: ${generatedResult.category}`);
				results.push(`📝 Content length: ${generatedResult.content.length} characters`);

				// Dispatch to GitHub repository with AI-chosen category
				const dispatched = await this.fileUtils.githubDispatch(scrapedBlog.title, generatedResult.content, scrapedBlog, post.url);
				if (dispatched.success) {
					results.push(`🚀 Successfully dispatched to GitHub: ${dispatched.filename}`);
					results.push(`   Repository: ${this.env.REPO_OWNER}/${this.env.REPO_NAME}`);
					results.push(`   Path: ${dispatched.path}`);

					// Log image generation details
					if (dispatched.imageGenerated) {
						results.push('🎨 Blog image generated and included:');
						results.push(`   Image filename: ${dispatched.imageFilename}`);
						results.push(`   Image path: ${dispatched.imagePath}`);
						results.push(`   R2 graphic used: ${generatedResult.category}.png from BLOG_GRAPHICS_BUCKET`);
					} else {
						results.push('⚠️  No image generated - using gradient fallback in GitHub Actions');
					}
				} else {
					results.push(`❌ Failed to dispatch to GitHub: ${scrapedBlog.filename}`);
					if (dispatched.error) {
						results.push(`   Error: ${dispatched.error}`);
					}
				}
			}
			return results;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			results.push(`❌ Error processing post ${post.url}: ${errorMessage}`);
			return results;
		}
	}
}

// export default {
// 	// Handle HTTP requests (for testing)
// 	async fetch(req: Request, env: Env): Promise<Response> {
// 		const url = new URL(req.url);

// 		if (url.pathname === '/test' || url.pathname === '/__scheduled') {
// 			const crawler = new BlogCrawlerWorker(env);
// 			const results = await crawler.run();

// 			return new Response(results.join('\n'), {
// 				headers: { 'Content-Type': 'text/plain' },
// 			});
// 		}

// 		return new Response(
// 			`Blog Crawler Worker

// Visit /test to manually trigger the crawler
// Scheduled to run daily at 9 AM UTC

// Environment: ${env.ENVIRONMENT}
// KV Namespace: ${env.BLOG_SCRAPED_URLS ? 'Connected' : 'Not Connected'}
// OpenAI API: ${env.OPENAI_API_KEY ? 'Configured' : 'Missing'}
// GitHub Token: ${env.GITHUB_TOKEN ? 'Configured' : 'Missing'}
// GitHub Repo: ${env.REPO_OWNER ? `${env.REPO_OWNER}/${env.REPO_NAME}` : 'Not Configured'}
// `,
// 			{
// 				headers: { 'Content-Type': 'text/plain' },
// 			}
// 		);
// 	},

// 	// Scheduled handler - runs on cron schedule
// 	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
// 		console.log(`🕘 Scheduled execution triggered: ${new Date().toISOString()}`);

// 		const crawler = new BlogCrawlerWorker(env);
// 		const results = await crawler.run();

// 		// Log results
// 		console.log('Blog Crawler Results:');
// 		for (const result of results) {
// 			console.log(result);
// 		}
// 	},
// } satisfies ExportedHandler<Env>;

export default {
	// Handle HTTP requests (for testing)
	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url);

		if (url.pathname === '/test' || url.pathname === '/__scheduled') {
			const crawler = new BlogCrawlerWorker(env);
			const results = await crawler.run();

			return new Response(results.join('\n'), {
				headers: { 'Content-Type': 'text/plain' },
			});
		}

		return new Response(
			`Blog Crawler Worker

Visit /test to manually trigger the crawler
Scheduled to run daily at 9 AM UTC

Environment: ${env.ENVIRONMENT}
KV Namespace: ${env.BLOG_SCRAPED_URLS ? 'Connected' : 'Not Connected'}
OpenAI API: ${env.OPENAI_API_KEY ? 'Configured' : 'Missing'}
GitHub Token: ${env.GITHUB_TOKEN ? 'Configured' : 'Missing'}
GitHub Repo: ${env.REPO_OWNER ? `${env.REPO_OWNER}/${env.REPO_NAME}` : 'Not Configured'}
R2 Graphics: ${env.BLOG_GRAPHICS_BUCKET ? 'Connected' : 'Not Connected'}
Browser API: ${env.MYBROWSER ? 'Connected' : 'Not Connected'}
`,
			{
				headers: { 'Content-Type': 'text/plain' },
			}
		);
	},

	// Scheduled handler - runs on cron schedule
	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log(`🕘 Scheduled execution triggered: ${new Date().toISOString()}`);

		const crawler = new BlogCrawlerWorker(env);
		const results = await crawler.run();

		// Log results
		console.log('Blog Crawler Results:');
		for (const result of results) {
			console.log(result);
		}
	},
} satisfies ExportedHandler<Env>;
