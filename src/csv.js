// Same pinned donor-compatible Papa parser, with all network/file/worker streamers removed.
import {parseLocalCSV} from './vendor/papaparse-local.js';
export function csvStringToJson(str){return parseLocalCSV(str.trim());}
