// Extract the pinned PapaParse pure text parser. No streamers, workers or transports enter the App.
import fs from 'node:fs';
import {parse} from 'acorn';
const source=fs.readFileSync('node_modules/papaparse/papaparse.js','utf8');
const names=new Set(['ParserHandle','Parser','escapeRegExp','copy','isFunction']), found=new Map();
function walk(node){if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'&&names.has(node.id.name))found.set(node.id.name,source.slice(node.start,node.end));for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
walk(parse(source,{ecmaVersion:'latest'}));if(found.size!==names.size)throw new Error('Pinned PapaParse layout changed');
fs.mkdirSync('src/vendor',{recursive:true});fs.writeFileSync('src/vendor/papaparse-local.js',`/*! PapaParse 5.5.3, Copyright (c) 2015 Matthew Holt. MIT licence: public/licenses/papaparse-5.5.3-LICENSE.txt.\n * Generated local-only subset; all original parsing functions retained verbatim. */\nconst Papa={BAD_DELIMITERS:['\\r','\\n','"','\\ufeff'],RECORD_SEP:String.fromCharCode(30),UNIT_SEP:String.fromCharCode(31),DefaultDelimiter:','};\n${[...found.values()].join('\n\n')}\nexport function parseLocalCSV(input){if(typeof input!=='string')throw new TypeError('CSV must be text');return new ParserHandle({}).parse(input);}\n`);
