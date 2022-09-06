const fs = require('fs');
const base64Img = require('base64-img');
const path = require('path');
const imgBase64 = 'data:image/png;base64,';
const inquirer = require('inquirer');
const gradient = require('gradient-string');
const logUpdate = require('log-update');
const chalk = require('chalk');
const ascii = require('ascii-table');
const child = require('child-process-async');
const os = require('node-os-utils');
const os_ = require('os');
const table = new ascii('Convert file info');
table.setHeading('Filename', 'Size (MB)', 'Type', 'Created', 'Convert');
const byteToMB = (byte) => (byte / 1024 / 1024).toFixed(2);
const getFileInfo = (_, fileName) => {
    const file = fs.statSync(path.resolve(_, fileName));
    return {
        filename: fileName,
        size: byteToMB(file.size),
        created: file.birthtime,
    };
}
const secondsInYear = 31536000;
const secondsInDay = 86400;
const secondsInHour = 3600;
const secondsInMinute = 60;
let michosPath = path.resolve(process.env.ProgramFiles, 'N0vaDesktop', 'N0vaDesktopCache', 'game');
function progessBar(
    total,
    current,
    option = {
        type: 'split',
        length: 50,
        line: null,
        slider: null,
    },
    nowplay = false,
) {
    if (option.type == 'split') {
        let line = option.line;
        let slider = option.slider;
        if (!line) line = '▬';
        if (!slider) slider = '🔘';
        const per = Math.round((current / total) * option.length);
        if (!nowplay) {
            let lined = '';
            let i = 0;
            while (i <= option.length) {
                if (i < per || i > per) lined += line;
                if (i == per) lined += slider;
                i++;
            }
            return [
                lined,
                ((current / total) * 100).toFixed(2) + ' %',
                current + ' / ' + total,
            ];
        }
        else {
            let lineback = '';
            let lineafter = '';
            let i = 0;
            while (i <= option.length) {
                if (i < per) lineback += line;
                if (i > per) lineafter += line;
                i++;
            }
            return [lineback, slider, lineafter];
        }
    }
    else if (option.type == 'filled') {
        const per = Math.round((current / total) * option.length);
        let lined = '';
        let i = 0;
        while (i <= option.length) {
            if (i > per) lined += '□';
            if (i < per || i == per) lined += '■';
            i++;
        }
        return [
            lined,
            ((current / total) * 100).toFixed(2) + ' %',
            current + ' / ' + total,
        ];
    }
    else {
        throw 'Option.type wrong (split / filled)';
    }
}
function getHumanizedElapsedTime(
    timeunix,
    locale_vn = false,
) {
    const seconds = timenowsecond(timeunix);
    if (seconds < 0) {
        return '?';
    }
    if (seconds < 60) {
        return `${seconds}s`;
    }

    return [
        { time: seconds / secondsInYear, label: locale_vn ? ' năm' : 'y' },
        {
            time: (seconds % secondsInYear) / secondsInDay,
            label: locale_vn ? ' ngày' : 'd',
        },
        {
            time: (seconds % secondsInDay) / secondsInHour,
            label: locale_vn ? ' giờ' : 'h',
        },
        {
            time: (seconds % secondsInHour) / secondsInMinute,
            label: locale_vn ? ' phút' : 'm',
        },
        { time: seconds % secondsInMinute, label: locale_vn ? ' giây' : 's' },
    ]
        .map(({ time, label }) => ({ time: Math.floor(time), label }))
        .filter(({ time }) => time)
        .map(({ time, label }) => `${time}${label}`)
        .join(' ');
};
function timenowsecond(timeunix) {
    if (!timeunix) {
        return undefined;
    }
    const elapsedTime = Math.abs((Date.now() - parseInt(timeunix)) / 1000); // lấy gttd
    return elapsedTime <= 0 ? 0 : elapsedTime.toFixed(1);
};
function getTime(timejs = new Date().getTime()) {
    if (timejs.toString().length == 10) timejs = timejs * 1000;
    const timenow = new Date(timejs)
        // .toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
        .toLocaleString()
        .toString();
    return timenow;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const checkDirExists = (dir, checkNDF = false, makeDir = false) => {
    if (checkNDF) {
        if (!fs.existsSync(dir)) {
            return false;
        }
        return fs.readdirSync(dir).filter(file => !fs.statSync(path.join(dir, file)).isDirectory() && file.endsWith('.ndf')).length > 0;
    }
    if (makeDir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {
                recursive: true,
            });
        }
        return true;
    }
    return fs.existsSync(dir);
};
// Img PNG hex : 89 50 4E 47 ... (50 4E 47 = PNG)
// => imgBase64 + Convert base64 string
// Video (mp4): 00 00 00 00 ... 
// => Delete 2 byte (00 00) => Rename to mp4

async function convertToPNG(path_, saveAs = '', fileName) {
    await base64Img.imgSync(imgBase64 + fs.readFileSync(path_, 'base64').toString(), saveAs, fileName);
}

async function convertToMP4(path_, saveAs = '', fileName) {
    await fs.writeFileSync(path.resolve(saveAs, `${fileName}.mp4`), fs.readFileSync(path_).slice(2), 'binary');
}

async function checkType(path_) {
    /**
     * @type {Buffer}
     */
    const typeBuffer = await fs.readFileSync(path_);
    if (!(typeBuffer instanceof Buffer)) return undefined;
    const type = typeBuffer.slice(0, 4).toString('hex');
    if (type.includes('504e47')) return 'PNG';
    else if (type.includes('000000')) return 'MP4';
    else return undefined;
}

async function main(result) {
    const path__ = result.rootPath;
    const save_ = result.savePath;
    // readdir
    let files = await fs.readdirSync(path__)
        .filter(file => file.endsWith('.ndf'))
        .filter(file => !fs.lstatSync(path.resolve(path__, file)).isDirectory());
    const choices = files.map(name => new Object({
        name,
    }));
    const res = await inquirer.prompt([
        {
            type: 'checkbox',
            message: 'Select file(s) to convert',
            name: 'files',
            choices,
            validate(answer) {
                if (answer.length < 1) {
                    return 'You must choose at least one file.';
                }
                return true;
            },
        },
    ]);
    const timeLoad = new Date().getTime();
    let index = 0;
    let errorIndex = 0;
    await Promise.all(res.files.map(async fileName => {
        const path_ = path.resolve(path__, fileName);
        const type = await checkType(path_);
        const info = getFileInfo(path__, fileName);
        // table.setHeading('Filename', 'Size', 'Type', 'Created', 'Convert');
        if (type == 'PNG') {
            await convertToPNG(path_, save_, fileName);
            index++;
            table.addRow(fileName, info.size, 'image/png', info.created.toLocaleString().toString(), '✔️ Success');
        } else if (type == 'MP4') {
            await convertToMP4(path_, save_, fileName);
            index++;
            table.addRow(fileName, info.size, 'video/mp4', info.created.toLocaleString().toString(), '✔️ Success');
        } else {
            errorIndex++;
            table.addRow(fileName, info.size, '?', info.created.toLocaleString().toString(), '❌ Error');
        }
        const res_ = await progessBar(res.files.length, index, { type: 'filled', length: 50 });
        logUpdate(`
            ${res_[1]} [${gradient.rainbow(res_[0])}] | ${res_[2]}
            > ${path.resolve(path_)} converting ...
            ETA: ${getHumanizedElapsedTime(timeLoad)} - Time: ${getTime()} - Fail : ${errorIndex}`);
    }));
    logOutput(path__, save_, index, errorIndex, timeLoad);
}

const chooseFolder = async () => {
    const question = {
        type: 'input',
        name: 'rootPath',
        message: "Enter the path to the destination folder (.ndf files)",
        validate(answer) {
            if (answer.length < 1 || !checkDirExists(answer, true)) {
                return 'Please enter a valid path';
            }
            return true;
        }
    }
    if (checkDirExists(michosPath)) {
        question.default = () => michosPath;
    }
    const res = await inquirer.prompt([
        question,
        {
            type: 'input',
            name: 'savePath',
            message: "Enter the path to save the converted files",
            default: () => {
                // Desktop folder
                return path.resolve(os_.homedir(), 'Desktop', 'N0va');
            },
            validate(answer) {
                if (answer.length < 1 || !checkDirExists(answer, false, true)) {
                    return 'Please enter a valid path';
                }
                return true;
            }
        }
    ]);
    return res;
}

const logOutput = async (root_, path_, success, failed, time) => {
    console.clear();
    console.log(
        `
        ${chalk.bold.blueBright('N0va Desktop')} File Converter

Github: ${chalk.hex('#F4BFC7')('aiko-chan-ai')}

System Information:

        CPU: ${os.cpu.model()} [Usage: ${chalk.redBright((await (os.cpu).usage()) + '%')}]
        RAM: ${await os.mem.info().then(m => `Total: ${m.totalMemMb} MB | Free: ${chalk.greenBright(m.freeMemMb + ' MB')}`)}

Convert Infomation:

    Source path: ${root_}

    Save path: ${path_}

    Success: ${chalk.bold.green(success)} | Failed: ${chalk.bold.red(failed)}

    Time: ${getHumanizedElapsedTime(time)}

${table.toString()}

The application will automatically exit after 30s
`
    );
    showPopup();
}

const showPopup = () => {
    child.execSync('msg %username% Successfully converted files! The application will automatically exit after 30s');
}

(async () => {
    const res = await chooseFolder();
    await main(res);
    await sleep(30000);
})();