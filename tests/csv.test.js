import {it,expect} from 'vitest';
import Papa from 'papaparse';
import {csvStringToJson} from '../src/csv.js';
for(const source of ['A,B\n1,2','A\tB\r\n1\t2','A;B\n1;2','"Comma, value",B\n"line\nbreak","a""b"','A,B\r1,2','A,B\n"bad,quote','one',''])it(`matches pinned parser for ${JSON.stringify(source)}`,()=>{expect(csvStringToJson(source)).toEqual(Papa.parse(source.trim()));});
