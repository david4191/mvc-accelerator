"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSafePath = resolveSafePath;
const path = __importStar(require("path"));
/**
 * Resolves a server-provided relative file path against a chosen workspace
 * root, rejecting anything that could escape it (absolute paths, ".."
 * traversal, drive-letter paths, null bytes). Returns undefined for any
 * path that fails these checks - callers must treat that as "do not write
 * this file", never fall back to writing it anyway.
 */
function resolveSafePath(workspaceRoot, relativePath) {
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
//# sourceMappingURL=PathSafety.js.map