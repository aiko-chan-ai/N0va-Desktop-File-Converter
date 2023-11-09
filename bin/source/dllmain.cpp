#include "pch.h"
#include "n0va.h"

extern "C" {
    __declspec(dllexport) void openFile(wchar_t* result, size_t size) {
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
            wcsncpy_s(result, size, selectedFile.c_str(), _TRUNCATE);
        }
        else {
            wcsncpy_s(result, size, L"", _TRUNCATE);
        }
    }

    __declspec(dllexport) void saveFolder(wchar_t* result, size_t size) {
        BROWSEINFO bi = { 0 };
        bi.ulFlags = BIF_RETURNONLYFSDIRS;
        LPITEMIDLIST pidl = SHBrowseForFolder(&bi);

        if (pidl != nullptr) {
            TCHAR selectedPath[MAX_PATH];
            if (SHGetPathFromIDList(pidl, selectedPath)) {
                wcsncpy_s(result, size, selectedPath, _TRUNCATE);
            }

            IMalloc* pMalloc;
            if (SUCCEEDED(SHGetMalloc(&pMalloc))) {
                pMalloc->Free(pidl);
                pMalloc->Release();
            }
        }
        else {
            wcsncpy_s(result, size, L"", _TRUNCATE);
        }
    }
}
