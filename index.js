process.title = 'N0va Desktop File Converter';

const fs = require('fs');
const base64Img = require('base64-img');
const path = require('path');
const imgBase64 = 'data:image/png;base64,';
const gradient = require('gradient-string');
const chalk = require('chalk');
const ascii = require('ascii-table');
const os = require('node-os-utils');
const os_ = require('os');
const table = new ascii('Convert file info');
const Dialog = require('node-win-dialog');

const getFileName = fullPath => fullPath.split('\\').pop()

const dialog = new Dialog();

table.setHeading('Filename', 'Size (MB)', 'Type', 'Created', 'Convert');
const byteToMB = (byte) => (byte / 1024 / 1024).toFixed(2);
const getFileInfo = (path__) => {
    const file = fs.statSync(path__);
    return {
        filename: getFileName(path__),
        size: byteToMB(file.size),
        created: file.birthtime,
    };
}
const secondsInYear = 31536000;
const secondsInDay = 86400;
const secondsInHour = 3600;
const secondsInMinute = 60;
let michosPath = path.resolve(process.env.ProgramFiles, 'N0vaDesktop', 'N0vaDesktopCache', 'game');

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

// Img PNG hex : 89 50 4E 47 ... (50 4E 47 = PNG)
// => imgBase64 + Convert base64 string
// Video (mp4): 00 00 00 00 ... 
// => Delete 2 byte (00 00) => Rename to mp4

async function convertToPNG(path_, saveAs = '', fileName) {
    console.log('Converting to PNG...', path_);
    await base64Img.imgSync(imgBase64 + fs.readFileSync(path_, 'base64').toString(), saveAs, fileName);
}

async function convertToMP4(path_, saveAs = '', fileName) {
    console.log('Converting to MP4...', path_);
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
    const allFiles = result.filter(string => string.endsWith('ndf'));
    // get save path
    let res_;
    let exited = false;
    res_ = await dialog.showFolderDialog('Choose save path');
    const checkfolder = path => {
        try {
            fs.accessSync(path);
            return true;
        } catch (error) {
            return false;
        }
    }
    while ((!res_.data || !checkfolder(res_.data))&& !exited) {
        const dialog_ = await dialog.showDialog(!res_.data ? 'No save path' : 'Wrong path save', 'N0va Desktop Convert File', "APPLICATION", "RETRY_CANCEL", "DEFAULT", "ERROR");
        if (dialog_.data == 'RETRY') {
            res_ = await dialog.showFolderDialog('Choose save path');
        } else {
            exited = true;
            process.exit(0);
        }
    }
    const savepath = path.resolve(res_.data);

    const timeLoad = new Date().getTime();
    let index = 0;
    let errorIndex = 0;
    await Promise.all(allFiles.map(async fileName => {
        fileName = path.resolve(fileName);
        const type = await checkType(fileName);
        const info = getFileInfo(fileName);
        // table.setHeading('Filename', 'Size', 'Type', 'Created', 'Convert');
        if (type == 'PNG') {
            await convertToPNG(fileName, savepath, getFileName(fileName));
            index++;
            table.addRow(getFileName(fileName), info.size, 'image/png', info.created.toLocaleString().toString(), '✔️ Success');
        } else if (type == 'MP4') {
            await convertToMP4(fileName, savepath, getFileName(fileName));
            index++;
            table.addRow(getFileName(fileName), info.size, 'video/mp4', info.created.toLocaleString().toString(), '✔️ Success');
        } else {
            errorIndex++;
            table.addRow(getFileName(fileName), info.size, '?', info.created.toLocaleString().toString(), '❌ Error');
        }
    }));
    logOutput(savepath, index, errorIndex, timeLoad);
}

const chooseFolder = async () => {
    const res = await dialog.showOpenFileDialog(true, 'Select files', {
        name: 'Nova Files (*.ndf)',
        ext: '*.ndf',
    });
    if(!res.data.filter(f => f.length > 0).length) process.exit(0);
    return res.data;
}

const logOutput = async (path_, success, failed, time) => {
    console.clear();
    console.log(
        `
        ${chalk.bold.blueBright('N0va Desktop')} File Converter

Github: ${chalk.hex('#F4BFC7')('aiko-chan-ai')}

System Information:

        CPU: ${os.cpu.model()} [Usage: ${chalk.redBright((await (os.cpu).usage()) + '%')}]
        RAM: ${await os.mem.info().then(m => `Total: ${m.totalMemMb} MB | Free: ${chalk.greenBright(m.freeMemMb + ' MB')}`)}

Convert Infomation:

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
    dialog.showDialog('Successfully converted files! The application will automatically exit after 30s', 'N0va Desktop Convert File', "APPLICATION", "OK", "DEFAULT", "INFORMATION");
}
(async () => {
    const res = await chooseFolder();
    await main(res);
    await sleep(30000);
})();