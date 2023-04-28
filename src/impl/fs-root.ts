import { parse } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const FS_ROOT = /*#__PURE__*/ pathToFileURL(/*#__PURE__*/ parse(process.cwd()).root);
