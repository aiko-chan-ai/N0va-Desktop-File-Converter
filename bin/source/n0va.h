#include "pch.h" 
#include <windows.h>
#include <iostream>
#include <string>
#include <io.h>
#include <fcntl.h>
#include <shlobj.h>
#include <commdlg.h>

#pragma once

#ifdef N0VA_TEST_EXPORTS
#define N0VA_TEST_API __declspec(dllexport)
#else
#define N0VA_TEST_API __declspec(dllimport)
#endif


extern "C" N0VA_TEST_API void openFile();
extern "C" N0VA_TEST_API void saveFolder();