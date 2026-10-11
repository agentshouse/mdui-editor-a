import js from '@eslint/js';
import globals from 'globals';
export default [{ignores:['src/house/*.ts']}, js.configs.recommended, {languageOptions:{globals:{...globals.browser,...globals.node}},rules:{'no-unused-vars':['error',{argsIgnorePattern:'^_'}]}}];
