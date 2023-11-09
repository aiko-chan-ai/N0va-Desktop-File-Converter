#pragma once

#include "pch.h"
#include <windows.h>
#include <iostream>
#include <string>
#include <io.h>
#include <fcntl.h>
#include <shlobj.h>
#include <commdlg.h>

#ifdef N0VA_TEST_EXPORTS
#define N0VA_TEST_API __declspec(dllexport)
#else
#define N0VA_TEST_API __declspec(dllimport)
#endif

extern "C" N0VA_TEST_API void openFile(wchar_t* result, size_t size);
extern "C" N0VA_TEST_API void saveFolder(wchar_t* result, size_t size);
