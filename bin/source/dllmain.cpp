#include "pch.h"
#include "n0va.h"

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