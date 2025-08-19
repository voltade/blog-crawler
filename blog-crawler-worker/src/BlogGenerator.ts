/**
 * BlogGenerator - Handles AI content generation using OpenAI
 */

import type { ScrapedBlog } from './BlogScraper';

export interface OpenAIResponse {
	choices: Array<{
		message: {
			content: string;
		};
	}>;
}

export class BlogGenerator {
	private openaiApiKey: string;
	private categories = ['Product Updates', 'Grants', 'CRM', 'Sales & Marketing', 'Product Support'];
	private categoryMap: Record<string, string> = {
		'Product Updates': 'product-update',
		Grants: 'grant',
		CRM: 'crm',
		'Sales & Marketing': 'sales-and-marketing',
		'Product Support': 'product-support',
	};

	constructor(openaiApiKey: string) {
		this.openaiApiKey = openaiApiKey;
	}

	async generateBlogWithAI(scrapedBlog: ScrapedBlog): Promise<{ content: string; category: string } | null> {
		try {
			// First, let AI categorize the content
			const aiCategory = await this.categorizeWithAI(scrapedBlog);
			const categoryPath = this.categoryMap[aiCategory] || 'product-update';

			console.log(`🤖 AI categorized "${scrapedBlog.title}" as: ${aiCategory} (${categoryPath})`);

			const aiReadyContent = this.prepareForOpenAI(scrapedBlog);
			const currentDate = new Date().toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
			});

			const cleanTitle = scrapedBlog.title
				.toLowerCase()
				.replace(/[^\w\s-]/g, '')
				.replace(/\s+/g, '-');

			const prompt = `Regenerate a blog post based on the following content:

${aiReadyContent}

IMPORTANT: Return ONLY the blog content. Do NOT wrap your response in markdown code blocks. Start directly with the frontmatter (---).

Use this EXACT format structure:

---
title: "Rewrite a new title similar to ${scrapedBlog.title}"
description: "Rewrite a new description similar to ${scrapedBlog.description}."
date: "${currentDate}"
category: "${aiCategory}"
readTime: "Generate based on the content length"
author: "Voltade Team"
image: "/images/blog/${categoryPath}/${cleanTitle}.jpg"
tags: "Choose relevant tags from ${JSON.stringify(this.categories)} and make them into an array" (e.g. ["Product Updates", "CRM"])
showSidebar: false
showOutline: true
content: { width: "100%" }
---

import { BlogLayout } from "../../layouts/BlogpageLayout.tsx";

export const fm = {
    title: "Same as the title you assignd to the post",
    description: "Same as the description you assigned to the post",
    date: "${currentDate}",
    category: "${aiCategory}",
    readTime: "Same as the read time you assigned to the post",
    author: "Voltade Team",
    image: "Same as the image you assigned to the post",
    tags: "Same as the tags you assigned to the post",
};

<BlogLayout frontmatter={fm}>

[The blog content goes here ...]

</BlogLayout>

REQUIREMENTS:
1. Rewrite the blog post based on the provided content comprehensively
2. Include success optimization tips
3. Make it actionable and strategic
4. DO NOT wrap in markdown code blocks
5. Wrap the content with the frontmatter and layout`;

			const response = await fetch('https://api.openai.com/v1/chat/completions', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.openaiApiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: 'gpt-4',
					messages: [
						{
							role: 'user',
							content: prompt,
						},
					],
					max_tokens: 4000,
					temperature: 0.7,
				}),
			});

			if (!response.ok) {
				throw new Error(`OpenAI API error: ${response.status}`);
			}

			const data = (await response.json()) as OpenAIResponse;
			const generatedContent = data.choices[0]?.message?.content || null;

			if (generatedContent) {
				return {
					content: generatedContent,
					category: categoryPath, // Return the slug, not the display name
				};
			}

			return null;
		} catch (error) {
			console.error(`Error generating AI content for ${scrapedBlog.title}:`, error);
			return null;
		}
	}

	private async categorizeWithAI(scrapedBlog: ScrapedBlog): Promise<string> {
		try {
			const contentSummary = `Title: ${scrapedBlog.title}\nDescription: ${scrapedBlog.description}`;

			const prompt = `Based on this blog post, choose the most appropriate category from: ${this.categories.join(', ')}.

${contentSummary}

Return only the category name from the list above.`;

			const response = await fetch('https://api.openai.com/v1/chat/completions', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.openaiApiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: 'gpt-3.5-turbo',
					messages: [
						{
							role: 'system',
							content: 'You are an expert content categorizer. Return only the exact category name from the provided list.',
						},
						{
							role: 'user',
							content: prompt,
						},
					],
					max_tokens: 20,
					temperature: 0.1,
				}),
			});

			if (!response.ok) {
				throw new Error(`OpenAI API error: ${response.status}`);
			}

			const data = (await response.json()) as OpenAIResponse;
			const aiCategory = data.choices[0]?.message?.content?.trim() || 'Product Updates';

			// Validate the category is in our list
			const validCategory = this.categories.includes(aiCategory) ? aiCategory : 'Product Updates';
			return validCategory;
		} catch (error) {
			console.error('Error categorizing with AI:', error);
			return 'Product Updates'; // Default fallback
		}
	}

	private prepareForOpenAI(scrapedData: ScrapedBlog): string {
		if (!scrapedData) return '';

		const promptSections = [`Title: ${scrapedData.title}\nDescription: ${scrapedData.description}\nCategory: ${scrapedData.category}\n\n`];

		for (const section of scrapedData.sections) {
			if (section.type === 'intro') {
				promptSections.push('Introduction:');
				for (const content of section.content) {
					if (content.type === 'paragraph' && content.text) {
						promptSections.push(`- ${content.text}`);
					}
				}
			}
		}

		return promptSections.join('\n');
	}
}
