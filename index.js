const package = require('./package.json');
process.title = `N0va Desktop File Converter v${package.version}`;
process.env.DEBUG = 'N0va:*';

const debug = require('debug');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');
const { spawnSync, exec } = require('child_process');

let timeFsDiff, timeAppDiff;
let log_string = `${process.title}\n\nGithub: aiko-chan-ai (Elysia)\n\n`;

const fsLog_ = debug('N0va:fs');
const appLog_ = debug('N0va:app');

const fsLog = function (msg) {
	if (!timeFsDiff) timeFsDiff = Date.now();
	log_string += `  N0va:fs ${msg} +${Date.now() - timeFsDiff}ms\n`;
	timeFsDiff = Date.now();
	fsLog_(msg);
};

const appLog = function (msg) {
	if (!timeAppDiff) timeAppDiff = Date.now();
	log_string += `  N0va:app ${msg} +${Date.now() - timeAppDiff}ms\n`;
	timeAppDiff = Date.now();
	appLog_(msg);
};

if (os.platform() !== 'win32') return;

const URL = `https://raw.githubusercontent.com/aiko-chan-ai/N0va-Desktop-File-Converter/main/bin/n0va-${os.arch()}.exe`;

class WindowsAPI {
	constructor(pathExe, exeName) {
		this.pathExe = pathExe;
		this.exeName = exeName;
	}
	spawnCommand(...args) {
		const str = spawnSync(this.exeName, args, {
			cwd: this.pathExe,
		}).stdout.toString('utf16le');
		if (str.endsWith('\r\n')) return str.slice(0, -2);
		if (str.endsWith('\n')) return str.slice(0, -1);
		return str;
	}
}

async function main() {
	const fileName = `n0va-${os.arch()}.exe`;
	const exeFile = path.resolve(os.tmpdir(), fileName);
	await downloadFile(URL, exeFile);

	const user32 = new WindowsAPI(os.tmpdir(), fileName);

	function openFile(showDialogStartup = true) {
		if (showDialogStartup) user32.spawnCommand('-dia_open_file');
		const result = user32.spawnCommand('-file');
		if (result.includes('No file selected or an error occurred.')) {
			user32.spawnCommand('-dia_cancel');
			return process.exit(0);
		}
		const pathParse = path.parse(result);
		if (fs.readdirSync(pathParse.dir).includes('N0vaDesktopCache')) {
			return path.resolve(pathParse.dir, 'N0vaDesktopCache');
		} else {
			user32.spawnCommand('-dia_invalid_path');
			return openFile(false);
		}
	}

	function saveFolder() {
		user32.spawnCommand('-dia_open_folder');
		const result = user32.spawnCommand('-folder');
		if (!result) {
			user32.spawnCommand('-dia_cancel');
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
	fs.writeFileSync(
		path.resolve(saveFolderPath, `log-${Date.now()}.txt`),
		log_string,
	);
	exec(`start explorer ${saveFolderPath}`);
	user32.spawnCommand('-dia_success');
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
		// Img PNG hex : 89 50 4E 47 ...
		// => imgBase64 + Convert base64 string
		// Video (mp4): 00 00 00 00 ...
		// => Delete 2 byte (00 00) => Rename to mp4
		file.on('close', () => {
			if (data = '89504e47') {
				r({
					type: 'png',
					skip: 0,
				});
			} else if (data.startsWith('ffd8ff')) {
				r({
					type: 'jpg',
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
