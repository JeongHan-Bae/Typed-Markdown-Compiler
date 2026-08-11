import { scanRemarkSyntax } from "./remark-syntax.ts";
import {
  TokenKind,
  type LexerToken,
  type SourcePosition,
  type TokenBase,
  type SyntaxNodeToken
} from "../tokens/types.ts";

/**
 * Scanner adapter. Unified/Remark performs Markdown, GFM, frontmatter, and
 * HTML recognition; this function only translates its result to the local
 * token contract consumed by the local AST parser.
 */
export function scanMarkdown(source: string): LexerToken[] {
  const tokens: LexerToken[] = [];
  for (const item of scanRemarkSyntax(source)) {
    const start = positionAt(source, item.startOffset);
    const end = positionAt(source, item.endOffset);
    if (item.node.type === "frontmatter") {
      tokens.push({
        kind: TokenKind.frontmatterStart,
        lexeme: source.slice(item.startOffset, Math.min(item.startOffset + 3, item.endOffset)),
        start,
        end: positionAt(source, Math.min(item.startOffset + 3, item.endOffset))
      });
      tokens.push({
        kind: TokenKind.frontmatterText,
        lexeme: item.node.value,
        start,
        end
      });
      tokens.push({
        kind: TokenKind.frontmatterEnd,
        lexeme: "---",
        start,
        end
      });
      continue;
    }

    const token: SyntaxNodeToken = {
      kind: TokenKind.syntaxNode,
      lexeme: item.lexeme,
      start,
      end,
      node: item.node
    };
    tokens.push(token);
  }

  const eof = positionAt(source, source.length);
  const eofToken: TokenBase<typeof TokenKind.eof> = {
    kind: TokenKind.eof,
    lexeme: "",
    start: eof,
    end: eof
  };
  tokens.push(eofToken);
  return tokens;
}

function positionAt(source: string, offset: number): SourcePosition {
  const boundedOffset = Math.max(0, Math.min(source.length, offset));
  const prefix = source.slice(0, boundedOffset);
  const lines = prefix.split(/\r?\n/u);
  return {
    offset: boundedOffset,
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1
  };
}
