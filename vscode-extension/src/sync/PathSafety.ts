import * as path from 'path';

/**
 * Resolves a server-provided relative file path against a chosen workspace
 * root, rejecting anything that could escape it (absolute paths, ".."
 * traversal, drive-letter paths, null bytes). Returns undefined for any
 * path that fails these checks - callers must treat that as "do not write
 * this file", never fall back to writing it anyway.
 */
export function resolveSafePath(workspaceRoot: string, relativePath: string): string | undefined {
    if (!relativePath || relativePath.includes('\0')) {
        return undefined;
    }

    // Reject absolute paths outright (POSIX "/..." or Windows "C:\...",
    // "\\...") - a server-provided path has no business claiming to be
    // absolute in the first place.
    if (path.isAbsolute(relativePath) || /^[a-zA-Z]:[\\/]/.test(relativePath)) {
        return undefined;
    }

    const normalized = path.normalize(relativePath);

    // path.normalize collapses "a/../b" to "b" but leaves a LEADING ".."
    // (e.g. "../../etc/passwd") alone - that's exactly the traversal case
    // we need to catch explicitly.
    if (normalized.split(path.sep).some((seg) => seg === '..')) {
        return undefined;
    }

    const resolved = path.resolve(workspaceRoot, normalized);
    const rootWithSep = workspaceRoot.endsWith(path.sep) ? workspaceRoot : workspaceRoot + path.sep;

    // Defense in depth: even after the segment check above, confirm the
    // final resolved path is still genuinely inside the workspace root.
    if (!resolved.startsWith(rootWithSep)) {
        return undefined;
    }

    return resolved;
}
