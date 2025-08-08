
import json
import os
from datetime import datetime
from openai import OpenAI


def generate_blog(content, post_data):
    """
    Generate blog content from the provided structured content.
    This is a placeholder function that would contain the logic to generate
    the blog content based on the structured data.
    """
    # Here you would implement the logic to generate the blog content
    # For now, we will just print the content for demonstration purposes
    # TODO: Add your AI generation logic here
    client = OpenAI(
        api_key="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"  # Reads from environment variable
        # Or alternatively: api_key="your-api-key-here"  # Less secure
    )
    category = ["Product Updates", "Grants", "CRM",
                "Sales & Marketing", "Product Support"]
    categoryMap = {
        "product-update": "product-updates",
        "grant": "grants",
        "crm": "crm",
        "sales-and-marketing": "sales-marketing",
        "product-support": "product-support"
    }
    completion = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "user",
             "content":
             f'''Regenerate a blog post based on the following content:\n\n{content}

IMPORTANT: Return ONLY the blog content. Do NOT wrap your response in markdown code blocks. Start directly with the frontmatter (---).

Use this EXACT format structure:

---
title: "Regenerate from {post_data['title']}"
description: "Regenerated content based on the original post."
date: "{datetime.now().strftime('%B %d, %Y')}"
category: {categoryMap[post_data['category']]
    if post_data['category'] in categoryMap else "General"}
readTime: "Generate based on the content length"
author: "Voltade Team"
image: "{categoryMap[post_data['category']]}/the title you assigned to the post with whitespaces joined by -" (e.g. product-updates/strategic-guide-to-funding-grants)"
tags: "Choose more than one relevant from {category} and make them into an array" (e.g. ["Product Updates", "CRM"])
showSidebar: false
showOutline: true
content: {{ width: "100%" }}
---

import {{ BlogLayout }} from "../../layouts/BlogpageLayout.tsx";

export const fm = {{
    title: "Same as the title you assigned to the post",
    description: "Same as the description you assigned to the post",
    date: "{datetime.now().strftime('%B %d, %Y')}",
    category: {categoryMap[post_data['category']] if post_data['category'] in categoryMap else "General"},
    readTime: "Same as the read time you assigned to the post",
    author: "Voltade Team",
    image: "Same as the image you assigned to the post",
    tags: "Same as the tags you assigned to the post",
}};

<BlogLayout frontmatter={{fm}}>

[The blog content goes here ...]

</BlogLayout>

REQUIREMENTS:
1. Rewrite the blog post based on the provided content comprehensively
2. Include success optimization tips
3. Make it actionable and strategic
4. DO NOT wrap in markdown code blocks
5. Wrap the content with the frontmatter and layout
'''}
        ]
    )
    content = completion.choices[0].message.content.strip()
    return content


def update_manifest_status(manifest_path, post_id, status_updates):
    """Update post status in manifest"""
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    if post_id in manifest['posts']:
        manifest['posts'][post_id].update(status_updates)

        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)

        return True
    return False


if __name__ == "__main__":
    manifest_path = 'scrapped_data/manifest.json'

    if not os.path.exists(manifest_path):
        print("❌ No manifest.json found. Run the scraper first!")
        exit(1)

    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    print(f"📋 Found {manifest['total_posts']} posts in manifest")

    # Process posts that haven't been generated yet
    ungenerated_posts = []
    for post_id, post_data in manifest['posts'].items():
        if not post_data.get('generated', False):
            ungenerated_posts.append((post_id, post_data))

    if not ungenerated_posts:
        print("✅ All posts have been generated!")
        exit(0)

    print(f"🔄 Found {len(ungenerated_posts)} posts to generate:")

    for post_id, post_data in ungenerated_posts:
        print(f"\n{'='*60}")
        print(f"Processing {post_id}: {post_data['title']}")
        print(f"{'='*60}")

        # Read the scraped content
        content_file = f"./scrapped_data/{post_data['category']}/{post_data['filename']}"
        if not os.path.exists(content_file):
            print(f"❌ Content file not found: {content_file}")
            continue

        with open(content_file, 'r', encoding='utf-8') as c:
            original_content = c.read()

        # Generate new content
        try:
            generated_content = generate_blog(original_content, post_data)

            # Save generated content
            generated_filename = f"{post_data['filename']}.md"
            generated_path = f"./generated_blogs/{post_data['category']}/{generated_filename}"

            with open(generated_path, 'w', encoding='utf-8') as f:
                f.write(generated_content)

            # Update manifest
            status_updates = {
                'generated': True,
                'generated_date': datetime.now().isoformat(),
                'generated_filename': generated_filename,
                'generated_word_count': len(generated_content.split())
            }

            if update_manifest_status(manifest_path, post_id, status_updates):
                print(f"✅ Generated and saved: {generated_path}")
                print(f"   Updated manifest for {post_id}")
            else:
                print(f"❌ Failed to update manifest for {post_id}")

        except Exception as e:
            print(f"❌ Error generating content for {post_id}: {e}")

    print(f"\n🎉 Blog generation complete!")
