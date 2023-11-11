#include <windows.h>
#include <iostream>
#include <string>
#include <io.h>
#include <fcntl.h>
#include <shlobj.h>
#include <commdlg.h>


void openFile() {
    OPENFILENAMEW ofn;
    wchar_t szFile[MAX_PATH] = L"";
    ZeroMemory(&ofn, sizeof(OPENFILENAMEW));
    ofn.lStructSize = sizeof(OPENFILENAMEW);
    ofn.hwndOwner = NULL;
    ofn.lpstrFile = szFile;
    ofn.nMaxFile = sizeof(szFile);
    ofn.lpstrFilter = L"Executable Files (*.exe)\0*.exe\0";
    ofn.nFilterIndex = 1;
    ofn.lpstrFileTitle = NULL;
    ofn.nMaxFileTitle = 0;
    ofn.lpstrInitialDir = NULL;
    ofn.Flags = OFN_PATHMUSTEXIST | OFN_FILEMUSTEXIST;
    ofn.lpstrTitle = L"Select N0va Desktop (N0vaDesktop.exe)";
    if (GetOpenFileNameW(&ofn) == TRUE) {
        std::wstring selectedFile(ofn.lpstrFile);
        std::wcout << L"{ \"msg\": \"" << selectedFile << L"\", \"status\": \"ok\" }" << std::endl;
    }
    else {
        std::wcout << L"{ \"msg\": \"No file selected or an error occurred.\", \"status\": \"fail\" " << std::endl;
    }
}

void saveFolder() {
    BROWSEINFO bi = { 0 };
    bi.ulFlags = BIF_RETURNONLYFSDIRS;
    LPITEMIDLIST pidl = SHBrowseForFolder(&bi);
    if (pidl != nullptr) {
        TCHAR selectedPath[MAX_PATH];
        if (SHGetPathFromIDList(pidl, selectedPath)) {
            std::wcout << L"{ \"msg\": \"" << selectedPath << L"\", \"status\": \"ok\" }" << std::endl;
        }
        IMalloc* pMalloc;
        if (SUCCEEDED(SHGetMalloc(&pMalloc))) {
            pMalloc->Free(pidl);
            pMalloc->Release();
        }
    }
    else {
        std::wcout << L"{ \"msg\": \"No folder selected or an error occurred.\", \"status\": \"fail\" " << std::endl;
    }
}

void openFileFirst() {
    std::wstring message = L"Select the path of N0va Desktop";
    std::wstring title = L"N0va Desktop File Converter";

    int result = MessageBoxW(NULL, message.c_str(), title.c_str(), MB_ICONINFORMATION | MB_OK);
    std::cout << result;
}

void cancel() {
    std::wstring message = L"The dialog has been canceled. The application will close.";
    std::wstring title = L"N0va Desktop File Converter";

    int result = MessageBoxW(NULL, message.c_str(), title.c_str(), MB_ICONEXCLAMATION | MB_OK);
    std::cout << result;
}

void invalidPath() {
    std::wstring message = L"The path of N0va Desktop is invalid";
    std::wstring title = L"N0va Desktop File Converter";

    int result = MessageBoxW(NULL, message.c_str(), title.c_str(), MB_ICONERROR | MB_OK);
    std::cout << result;
}

void saveFolderDialog() {
    std::wstring message = L"Choose a path to save the file";
    std::wstring title = L"N0va Desktop File Converter";

    int result = MessageBoxW(NULL, message.c_str(), title.c_str(), MB_ICONINFORMATION | MB_OK);
    std::cout << result;
}

void showConversionSuccessMessage() {
    std::wstring message = L"Successfully converted files!";
    std::wstring title = L"N0va Desktop File Converter";

    MessageBoxW(NULL, message.c_str(), title.c_str(), MB_ICONINFORMATION | MB_OK);
}

int main(int argc, char* argv[]) {
    _setmode(_fileno(stdin), _O_U16TEXT);
    _setmode(_fileno(stdout), _O_U16TEXT);

    if (argc < 2) {
        return 1;
    }

    std::string arg = argv[1];

    if (arg == "-file") {
        openFile();
    }
    else if (arg == "-folder") {
        saveFolderDialog();
    }
    else if (arg == "-dia_open_file") {
        openFileFirst();
    }
    else if (arg == "-dia_open_folder") {
        saveFolder();
    }
    else if (arg == "-dia_cancel") {
        cancel();
    }
    else if (arg == "-dia_invalid_path") {
        invalidPath();
    }
    else if (arg == "-dia_success") {
        showConversionSuccessMessage();
    }
    else {
        return 1;
    }
    return 0;
}