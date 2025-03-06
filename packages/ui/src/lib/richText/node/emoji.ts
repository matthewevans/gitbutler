import emojiData from 'emojibase-data/en/compact.json';
import emojiByHexcode from 'emojibase-data/en/shortcodes/github.json';
import { $applyNodeReplacement, TextNode } from 'lexical';
import {
	type BaseSelection,
	type EditorConfig,
	type LexicalNode,
	type NodeKey,
	type SerializedTextNode,
	type Spread,
	$isRangeSelection as isRangeSelection,
	$isTextNode as isTextNode,
	$createTextNode as createTextNode
} from 'lexical';
import type { CompactEmoji } from 'emojibase';

const EMOJI_SHORTCODE_REGEX = /(^|\s):([0-9a-z+_-]+):($|\s)/;
const EMOJI_SHORTCODE_SEARCH_REGEX = /(^|\s):([0-9a-z+_-]*)$/;

/**
 * Returns a list of emojis that match the given search query.
 */
export function searchThroughEmojis(searchQuery: string): CompactEmoji[] {
	const emojiEntries = Object.entries(emojiByHexcode);
	const emojiHexcodes = emojiEntries
		.filter(([_, shortCodes]) => {
			if (Array.isArray(shortCodes)) {
				return shortCodes.some((shortCode) => shortCode.startsWith(searchQuery));
			}
			return shortCodes.startsWith(searchQuery);
		})
		.map(([hexcode]) => hexcode);

	return emojiData.filter((emoji) => emojiHexcodes.includes(emoji.hexcode));
}

export type ShortCodeMatch = {
	start: number;
	end: number;
	shortCode: string;
};

/**
 * Returns information about the text that matches an emoji shortcode pattern
 */
export function getShortCodeMatch(text: string): ShortCodeMatch | null {
	const testResult = EMOJI_SHORTCODE_REGEX.exec(text);

	if (!testResult) {
		return null;
	}

	const shortCode = testResult[2];
	const start = testResult.index + testResult[1].length;
	const end = start + shortCode.length + 2; // Account for the colons

	return { start, end, shortCode };
}

export type ShortCodeSearchMatch = {
	start: number;
	end: number;
	searchQuery: string;
};

/**
 * Returns information about the text that matches an emoji shortcode search pattern.
 *
 * This pattern is used to suggest emojis based on the user's input.
 */
export function getShortCodeSearchMatch(text: string): ShortCodeSearchMatch | null {
	const testResult = EMOJI_SHORTCODE_SEARCH_REGEX.exec(text);

	if (!testResult) {
		return null;
	}

	const searchQuery = testResult[2];
	const start = testResult.index + testResult[1].length;
	const end = start + searchQuery.length + 1; // Account for the colon

	return { start, end, searchQuery };
}

/**
 * Returns the emoji that matches the given shortcode without colons.
 */
function findEmojiByShortcode(shortcode: string): CompactEmoji | undefined {
	const emoji = Object.entries(emojiByHexcode).find(([_, shortCodes]) => {
		if (Array.isArray(shortCodes)) {
			return shortCodes.includes(shortcode);
		}
		return shortCodes === shortcode;
	});

	if (!emoji) {
		return undefined;
	}

	const compactEmoji = emojiData.find((e) => e.hexcode === emoji[0]);
	return compactEmoji;
}

export type SerializedEmojiNode = Spread<
	{
		className: string;
	},
	SerializedTextNode
>;

export class EmojiNode extends TextNode {
	__className: string;

	static getType(): string {
		return 'emoji';
	}

	static clone(node: EmojiNode): EmojiNode {
		return new EmojiNode(node.__className, node.__text, node.__key);
	}

	constructor(className: string, text: string, key?: NodeKey) {
		super(text, key);
		this.__className = className;
	}

	createDOM(config: EditorConfig): HTMLElement {
		const dom = document.createElement('span');
		const inner = super.createDOM(config);
		dom.className = this.__className;
		inner.className = 'emoji-inner';
		dom.appendChild(inner);
		return dom;
	}

	updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
		const inner = dom.firstChild;
		if (inner === null) {
			return true;
		}
		super.updateDOM(prevNode, inner as HTMLElement, config);
		return false;
	}

	// static importJSON(serializedNode: SerializedEmojiNode): EmojiNode {
	// 	return $createEmojiNode(serializedNode.className, serializedNode.text).updateFromJSON(
	// 		serializedNode
	// 	);
	// }

	exportJSON(): SerializedEmojiNode {
		return {
			...super.exportJSON(),
			className: this.getClassName()
		};
	}

	getClassName(): string {
		const self = this.getLatest();
		return self.__className;
	}
}

export function $isEmojiNode(node: LexicalNode | null | undefined): node is EmojiNode {
	return node instanceof EmojiNode;
}

export function createEmojiNode(className: string, emojiText: string): EmojiNode {
	const node = new EmojiNode(className, emojiText).setMode('token');
	return $applyNodeReplacement(node);
}

function getTextSurroundingEmoji(text: string, start: number, end: number): [string, string] {
	const before = text.slice(0, start);
	let after = text.slice(end);
	after = after.startsWith(' ') ? after : ' ' + after;

	return [before, after];
}

interface EmojiInsertionParams {
	selection: BaseSelection | null;
	start: number;
	end: number;
	unicode: string;
}

export function insertEmoji(params: EmojiInsertionParams) {
	const { selection, start, end, unicode } = params;
	if (!isRangeSelection(selection)) return;

	const nodes = selection.getNodes();

	// Has to be the last node of the selection since we are replacing the
	// last thing the user typed.
	const lastNode = nodes[nodes.length - 1];
	if (!isTextNode(lastNode)) return;

	const text = lastNode.getTextContent();
	const [before, after] = getTextSurroundingEmoji(text, start, end);

	lastNode.setTextContent(before);

	const mention = createEmojiNode('emoji', unicode);

	lastNode.insertAfter(mention);
	const suffix = mention.insertAfter(createTextNode(after));
	suffix.selectEnd();
}

/**
 * Returns the node that should be replaced by an emoji node based on the given range.
 */
function getNodeToReplace(node: TextNode, start: number, end: number): TextNode {
	if (start === 0) {
		const [targetNode] = node.splitText(end);
		return targetNode;
	}

	const [, targetNode] = node.splitText(start, end);
	return targetNode;
}

/**
 * Finds an emoji shortcode in the given text node and replaces it with an emoji node.
 */
export function findAndReplaceShortCodeEmoji(node: TextNode): TextNode | undefined {
	const text = node.getTextContent();

	const shortCodeMatch = getShortCodeMatch(text);
	if (!shortCodeMatch) {
		return undefined;
	}

	const match = findEmojiByShortcode(shortCodeMatch.shortCode);

	if (!match) {
		return undefined;
	}

	const emojiNode = createEmojiNode('emoji', match.unicode);

	const targetNode = getNodeToReplace(node, shortCodeMatch.start, shortCodeMatch.end);
	targetNode.replace(emojiNode);
	return emojiNode;
}
