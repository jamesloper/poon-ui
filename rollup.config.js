import resolve from '@rollup/plugin-node-resolve';
import multiEntry from '@rollup/plugin-multi-entry';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';

export default {
	input: 'src/**/*.js',
	output: [{
		name: '@poon/ui',
		file: 'dist/index.js',
		format: 'esm',
		generatedCode: {constBindings: true},
	}, {
		name: '@poon/ui',
		file: 'dist/index.min.js',
		format: 'esm',
		plugins: [terser()],
	}],
	plugins: [
		resolve(),
		babel({
			presets: [
				['@babel/preset-react', {'useBuiltIns': true}],
			],
		}),
		multiEntry(),
	],
	external: ['@poon/router', '@poon/router/util.js'],
};
