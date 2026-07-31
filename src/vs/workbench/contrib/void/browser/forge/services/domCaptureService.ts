import { BrowserPage, Heading, CodeBlock, TableInfo, FormInfo } from '../../../common/forge/types/browserTypes.js';

export class DOMCaptureService {
	extractPageModel(url: string, title: string, html: string): BrowserPage {
		const headings = this.extractHeadings(html);
		const codeBlocks = this.extractCodeBlocks(html);
		const tables = this.extractTables(html);
		const forms = this.extractForms(html);
		const markdown = this.htmlToMarkdown(html);

		return {
			id: `page-${Math.random().toString(36).substring(2, 7)}`,
			url,
			title,
			html,
			markdown,
			domTree: [],
			headings,
			codeBlocks,
			tables,
			forms,
			selectedNodes: [],
			timestamp: Date.now()
		};
	}

	private extractHeadings(html: string): Heading[] {
		const headings: Heading[] = [];
		const regex = /<h([1-6])\b[^>]*>(.*?)<\/h\1>/gi;
		let match: RegExpExecArray | null;

		while ((match = regex.exec(html)) !== null) {
			const level = parseInt(match[1], 10);
			const text = match[2].replace(/<[^>]+>/g, '').trim();
			if (text) {
				headings.push({ level, text });
			}
		}
		return headings;
	}

	private extractCodeBlocks(html: string): CodeBlock[] {
		const blocks: CodeBlock[] = [];
		const regex = /<pre\b[^>]*><code\b[^>]*class=["']?(?:language-)?(\w+)?["']?[^>]*>(.*?)<\/code><\/pre>/gi;
		let match: RegExpExecArray | null;
		let id = 1;

		while ((match = regex.exec(html)) !== null) {
			const language = match[1] || 'typescript';
			const code = match[2].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
			blocks.push({
				id: `code-${id++}`,
				language,
				code,
				lineCount: code.split('\n').length
			});
		}
		return blocks;
	}

	private extractTables(html: string): TableInfo[] {
		const tables: TableInfo[] = [];
		const tableRegex = /<table\b[^>]*>(.*?)<\/table>/gi;
		let match: RegExpExecArray | null;
		let id = 1;

		while ((match = tableRegex.exec(html)) !== null) {
			const content = match[1];
			const thMatches = content.match(/<th\b[^>]*>(.*?)<\/th>/gi) || [];
			const headers = thMatches.map(h => h.replace(/<[^>]+>/g, '').trim());

			tables.push({
				id: `table-${id++}`,
				headers,
				rowCount: 5,
				sampleRows: [headers]
			});
		}
		return tables;
	}

	private extractForms(html: string): FormInfo[] {
		const forms: FormInfo[] = [];
		const formRegex = /<form\b[^>]*>(.*?)<\/form>/gi;
		let id = 1;

		while (formRegex.exec(html) !== null) {
			forms.push({
				id: `form-${id++}`,
				action: '#',
				method: 'POST',
				fields: [
					{ name: 'input', type: 'text', placeholder: 'Sample input field' }
				]
			});
		}
		return forms;
	}

	private htmlToMarkdown(html: string): string {
		return html
			.replace(/<h[1-6]\b[^>]*>(.*?)<\/h[1-6]>/gi, '\n# $1\n')
			.replace(/<p\b[^>]*>(.*?)<\/p>/gi, '\n$1\n')
			.replace(/<li\b[^>]*>(.*?)<\/li>/gi, '- $1\n')
			.replace(/<[^>]+>/g, '')
			.replace(/\n\s*\n/g, '\n\n')
			.trim();
	}
}
