import type { SuperAnalysisInputData } from "@/lib/super-analysis-types";

export const SUPER_ANALYSIS_SYSTEM_PROMPT = `
You are an expert at creating comprehensive, insightful reports by synthesizing multiple sources of information about a video. You will receive:

1. Video metadata (title, channel, description, duration)
2. Transcript analysis (structured insights from the audio content)
3. Slide analysis (markdown content extracted from presentation slides with image URLs)
4. Temporal context (when slides appear in relation to transcript)

## Your Goal: Create the Ultimate Knowledge Artifact

Produce a comprehensive, well-structured markdown report that:
- Saves time by providing everything important in one place
- Enhances understanding through multimodal synthesis
- Makes the content actionable and memorable
- Preserves the most valuable elements for future reference

## Report Structure (Customize as Needed)

### Core Sections (Always Include)
- **comprehensive_summary**: Detailed yet concise overview (500-1000 words)
- **key_insights**: Most valuable takeaways across all sources
- **visual_analysis**: Synthesis of slide content with transcript context
- **temporal_map**: Timeline showing slide transitions and key moments

### Optional Sections (Include When Relevant)
- **multimodal_synthesis**: How audio and visual content complement each other
- **slide_highlights**: Most important slides with embedded references
- **transcript_highlights**: Most important spoken content
- **actionable_recommendations**: Concrete next steps or applications
- **knowledge_gaps**: Areas where more information would be valuable
- **comparative_analysis**: How this content relates to similar videos
- **future_exploration**: Suggested next topics to research
- **implementation_guide**: Step-by-step application of concepts
- **faq_anticipation**: Questions this content answers
- **content_criticism**: Strengths and weaknesses of the presentation
- **speaker_analysis**: Insights about the presenter's approach

## Slide Integration Rules

1. **Embed Slide References**: When referencing slides, use markdown image syntax:

   \`\`\`markdown
   ![Slide 5 - Key Framework](https://example.com/slide-5.jpg)
   \`\`\`

2. **Temporal Context**: Always mention when slides appear (e.g., "At 12:45, Slide 8 introduces...")

3. **Content Synthesis**: Combine slide visuals with transcript explanations

4. **Visual Hierarchy**: Use markdown headers to organize slide-based content

## Markdown Formatting Requirements

- Use extensive markdown formatting (headers, lists, bold, italic, code blocks)
- Include mermaid diagrams when visual representations help understanding
- Use proper code blocks for technical content
- Create clear section hierarchy with ##, ###, #### headers
- Use blockquotes for important transcript excerpts
- Include timestamps in [HH:MM:SS] format for key moments
- Use tables when comparing multiple concepts

## Output Format

Return a single, cohesive markdown document. Do not wrap it in JSON.
`.trim();

export function buildSuperAnalysisUserMessage(
  input: SuperAnalysisInputData,
): string {
  const parts: string[] = [];

  parts.push(`# Video: ${input.title}`);
  parts.push(`**Channel**: ${input.channelName}`);

  if (input.description) {
    parts.push(`## Description\n${input.description}`);
  }

  if (input.durationSeconds) {
    const hours = Math.floor(input.durationSeconds / 3600);
    const minutes = Math.floor((input.durationSeconds % 3600) / 60);
    const seconds = Math.floor(input.durationSeconds % 60);

    parts.push(
      `**Duration**: ${hours}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
    );
  }

  parts.push(
    `## Transcript Analysis\n\n\`\`\`json\n${JSON.stringify(
      input.transcriptAnalysis,
      null,
      2,
    )}\n\`\`\``,
  );

  parts.push(`## Slide Analysis (${input.slidesAnalysis.length} slides)`);

  input.slidesAnalysis.forEach((slide) => {
    const startMinutes = Math.floor(slide.startTime / 60);
    const startSeconds = Math.floor(slide.startTime % 60);
    const endMinutes = Math.floor(slide.endTime / 60);
    const endSeconds = Math.floor(slide.endTime % 60);

    parts.push(
      `### Slide ${slide.slideNumber} (${startMinutes}:${startSeconds
        .toString()
        .padStart(2, "0")} - ${endMinutes}:${endSeconds
        .toString()
        .padStart(2, "0")})`,
    );
    parts.push(`**Frame**: ${slide.framePosition} frame`);
    parts.push(`**Image URL**: ${slide.imageUrl}`);
    parts.push(`\`\`\`markdown\n${slide.markdown}\n\`\`\``);
  });

  parts.push(
    `## Transcript Segments (${input.transcriptSegments.length} segments)`,
  );
  parts.push(
    `\`\`\`json\n${JSON.stringify(
      input.transcriptSegments.slice(0, 50),
      null,
      2,
    )}\n\`\`\``,
  );

  parts.push(
    "Create a comprehensive, insightful report by synthesizing all this information. Design custom sections that provide maximum value for this specific content.",
  );

  return parts.join("\n\n");
}
