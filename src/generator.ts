import OpenAI from "openai";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import type { BlogGenerationRequest, GeneratedBlog } from "./types.js";

export class BlogGenerator {
    private client: OpenAI;
    private categoryMap: Record<string, string> = {
        "product-update": "Product Updates",
        grant: "Grants",
        crm: "CRM",
        "sales-and-marketing": "Sales & Marketing",
        "product-support": "Product Support",
    };

    constructor(apiKey: string) {
        this.client = new OpenAI({ apiKey });
    }

    /**
     * Generate blog content using OpenAI
     */
    async generateBlog(
        content: string,
        postData: { title: string; category: string; description?: string }
    ): Promise<string> {
        try {
            const categories = Object.values(this.categoryMap);
            const currentDate = new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
            });

            const completion = await this.client.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "user",
                        content: `Regenerate a blog post based on the following content:\\n\\n${content}

IMPORTANT: Return ONLY the blog content. Do NOT wrap your response in markdown code blocks. Start directly with the frontmatter (---).

Use this EXACT format structure:

---
title: "Regenerated title based on the original content"
description: "Regenerated description based on the original post."
date: "${currentDate}"
category: "Choose a relevant category from: ${categories.join(", ")}"
readTime: "Generate based on the content length (e.g., '5 min read')"
author: "Voltade Team"
image: "category-slug/post-title-with-dashes (e.g., product-updates/strategic-guide-to-funding-grants)"
tags: ["Choose", "relevant", "tags", "from", "categories"]
showSidebar: false
showOutline: true
content: { width: "100%" }
---

import { BlogLayout } from "../../layouts/BlogpageLayout.tsx";

export const fm = {
  title: "Same as the title you assigned above",
  description: "Same as the description you assigned above", 
  date: "${currentDate}",
  category: "Same as the category you assigned above",
  readTime: "Same as the readTime you assigned above",
  author: "Voltade Team",
  image: "Same as the image path you assigned above",
  tags: ["Same", "as", "tags", "array", "above"],
};

<BlogLayout frontmatter={fm}>

[Write your comprehensive blog content here - 2000+ words]

# Main Title Here

## Section 1

[Content...]

## Section 2 

[Content...]

## Conclusion

[Content...]

</BlogLayout>

REQUIREMENTS:
1. Rewrite the blog post comprehensively (2000+ words)
2. Maintain the same structure and key points
3. Make it actionable and strategic
4. Use different wording while keeping the same information
5. DO NOT wrap in markdown code blocks
6. Start directly with the frontmatter ---
7. Include the BlogLayout wrapper exactly as shown`,
                    },
                ],
            });

            const generatedContent = completion.choices[0].message.content?.trim();
            if (!generatedContent) {
                throw new Error("No content generated from OpenAI");
            }

            return generatedContent;
        } catch (error) {
            console.error("❌ Error generating blog content:", error);
            throw error;
        }
    }

    /**
     * Save generated blog to file system
     */
    saveBlogToFile(content: string, filename: string, category: string): GeneratedBlog {
        try {
            // Create directory structure
            const outputDir = join(process.cwd(), "generated_blogs", category);
            if (!existsSync(outputDir)) {
                mkdirSync(outputDir, { recursive: true });
            }

            // Ensure filename ends with .mdx
            const blogFilename = filename.endsWith(".mdx") ? filename : `${filename}.mdx`;
            const filePath = join(outputDir, blogFilename);

            // Save file
            writeFileSync(filePath, content, "utf-8");

            const generatedBlog: GeneratedBlog = {
                title: this.extractTitleFromContent(content),
                content,
                filename: blogFilename,
                wordCount: content.split(/\\s+/).length,
                generatedDate: new Date().toISOString(),
            };

            console.log(`✅ Generated blog saved: ${filePath}`);
            console.log(`   Word count: ${generatedBlog.wordCount}`);

            return generatedBlog;
        } catch (error) {
            console.error("❌ Error saving blog file:", error);
            throw error;
        }
    }

    /**
     * Extract title from generated content
     */
    private extractTitleFromContent(content: string): string {
        const titleMatch = content.match(/title:\\s*"([^"]+)"/);
        return titleMatch ? titleMatch[1] : "Generated Blog Post";
    }

    /**
     * Clean filename to be filesystem-safe
     */
    cleanFilename(title: string): string {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\\s-]/g, "")
            .trim()
            .replace(/\\s+/g, "-")
            .replace(/-+/g, "-")
            .substring(0, 100); // Limit length
    }
}
