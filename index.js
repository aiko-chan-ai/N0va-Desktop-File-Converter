const package = require('./package.json');
process.title = `N0va Desktop File Converter v${package.version}`;
process.env.DEBUG = 'N0va:*';

const debug = require('debug');
const ffi = require('ffi-napi');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');
const util = require('util');

const fsLog = debug('N0va:fs');
const appLog = debug('N0va:app');

if (os.platform() !== 'win32') return;

const URL = `https://raw.githubusercontent.com/aiko-chan-ai/N0va-Desktop-File-Converter/main/bin/n0va-${os.arch()}.dll`;

async function main() {
	const dllFile = path.resolve(os.tmpdir(), `n0va-${os.arch()}.dll`);
	await downloadFile(URL, dllFile);
	const myDll = ffi.Library(dllFile, {
		openFile: ['void', ['string', 'size_t']],
		saveFolder: ['void', ['string', 'size_t']],
	});
	const user32 = ffi.Library('user32', {
		MessageBoxW: ['int32', ['int32', 'string', 'string', 'int32']],
	});
	function openFile(showDialogStartup = true) {
		if (showDialogStartup)
			user32.MessageBoxW(
				0,
				Buffer.from(
					'Select the path of N0va Desktop\0',
					'ucs2',
				).toString(),
				Buffer.from(`${process.title}\0`, 'ucs2'),
				0x00 + 0x40,
			);
		const bufferSize = 10240;
		const buffer = Buffer.alloc(bufferSize);
		myDll.openFile(buffer, bufferSize);
		const result = buffer.toString('ucs2').replace(/\0/g, '');
		if (!result) {
			user32.MessageBoxW(
				0,
				Buffer.from(
					'You have canceled, the application will exit\0',
					'ucs2',
				).toString(),
				Buffer.from(`${process.title}\0`, 'ucs2'),
				0x00 + 0x30,
			);
			return process.exit(0);
		}
		const pathParse = path.parse(result);
		if (fs.readdirSync(pathParse.dir).includes('N0vaDesktopCache')) {
			return path.resolve(pathParse.dir, 'N0vaDesktopCache');
		} else {
			const i = user32.MessageBoxW(
				0,
				Buffer.from(
					'The path of N0va Desktop is invalid\0',
					'ucs2',
				).toString(),
				Buffer.from(`${process.title}\0`, 'ucs2'),
				0x05 + 0x10,
			);
			if (i == 4) {
				return openFile(false);
			} else {
				process.exit(0);
			}
		}
	}
	function saveFolder() {
		user32.MessageBoxW(
			0,
			Buffer.from('Choose a path to save the file\0', 'ucs2').toString(),
			Buffer.from(`${process.title}\0`, 'ucs2'),
			0x00 + 0x40,
		);
		const bufferSize = 10240;
		const buffer = Buffer.alloc(bufferSize);
		myDll.saveFolder(buffer, bufferSize);
		const result = buffer.toString('ucs2').replace(/\0/g, '');
		if (!result) {
			user32.MessageBoxW(
				0,
				Buffer.from(
					'You have canceled, the application will exit\0',
					'ucs2',
				).toString(),
				Buffer.from(`${process.title}\0`, 'ucs2'),
				0x00 + 0x30,
			);
			return process.exit(0);
		}
		return result;
	}
	const folderN0va = openFile();
	const saveFolderPath = saveFolder();
	appLog(`N0va: ${folderN0va}`);
	appLog(`Save: ${saveFolderPath}`);
	await Promise.all(
		scanForNdfFiles(folderN0va).map((_) =>
			convert(_, saveFolderPath, folderN0va),
		),
	);
	user32.MessageBoxW(
		0,
		Buffer.from('Successfully converted files!\0', 'ucs2').toString(),
		Buffer.from(`${process.title}\0`, 'ucs2'),
		0x00 + 0x40,
	);
}

function scanForNdfFiles(directory) {
	const ndfFiles = [];

	function scanDirectory(dir) {
		const files = fs.readdirSync(dir);

		files.forEach((file) => {
			const filePath = path.join(dir, file);
			const stats = fs.statSync(filePath);

			if (stats.isDirectory()) {
				// If it's a directory, recursively scan it
				scanDirectory(filePath);
			} else if (stats.isFile() && file.endsWith('.ndf')) {
				// If it's a file with the ".ndf" extension, add it to the list
				ndfFiles.push(filePath);
			}
		});
	}

	// Start scanning from the provided directory
	scanDirectory(directory);

	return ndfFiles;
}

async function convert(filePath, folderSave, original) {
	const pathData = path.parse(filePath);
	const folderPath = pathData.dir;
	const fileName = pathData.base;
	const obj = await checkData(folderPath, fileName);
	if (!obj.type) return;
	const type = obj.type;
	const skipByte = obj.skip;
	const processPath = path.resolve(folderPath, fileName);
	fsLog(`> Processing ${processPath} (Skip: ${skipByte})`);
	const file = fs.createReadStream(processPath, {
		start: skipByte,
	});
	const savePath = (folderSave + folderPath.replace(original, '')).replace(
		/\\\\/g,
		'\\',
	);
	if (!fs.existsSync(savePath)) {
		fs.mkdirSync(savePath, { recursive: true });
	}
	const processSave = path.resolve(savePath, fileName.replace('ndf', type));
	const save = fs.createWriteStream(processSave);
	return new Promise((r) => {
		file.pipe(save).on('close', () => {
			fsLog(`${processPath} > ${processSave} (Skip: ${skipByte})`);
			r(true);
		});
	});
}

function checkData(folderPath, fileName) {
	return new Promise((r) => {
		const processPath = path.resolve(folderPath, fileName);
		const file = fs.createReadStream(processPath, {
			encoding: 'hex',
			start: 0,
			end: 3,
		});
		let data = '';
		file.on('data', (d) => {
			data += d.toString();
		});
		// Img PNG hex : 89 50 4E 47 ... (50 4E 47 = PNG)
		// => imgBase64 + Convert base64 string
		// Video (mp4): 00 00 00 00 ...
		// => Delete 2 byte (00 00) => Rename to mp4
		file.on('close', () => {
			if (data.endsWith('504e47')) {
				r({
					type: 'png',
					skip: 0,
				});
			} else if (data.endsWith('000000')) {
				r({
					type: 'mp4',
					skip: 2,
				});
			} else {
				// invalid
				appLog(`> Invalid data: ${data} | ${processPath}`);
				r({
					type: null,
					skip: 0,
				});
			}
		});
	});
}

function downloadFile(url, fileName) {
	return new Promise((resolve, reject) => {
		fetch(url)
			.then((response) => {
				if (response.ok) {
					const fileStream = Readable.fromWeb(response.body).pipe(
						fs.createWriteStream(fileName),
					);
					fileStream.on('error', reject);
					fileStream.on('finish', resolve);
				} else {
					reject(
						new Error(
							'Failed to download file: ' + response.status,
						),
					);
				}
			})
			.catch(reject);
	});
}

main();
