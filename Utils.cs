using System;
using Microsoft.Win32;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.IO;

namespace N0vaDesktopFileConverter
{
    public static class Utils
    {
        public static string FindInstallPath(string appName)
        {
            if (string.IsNullOrWhiteSpace(appName)) return null;

            var views = new[] { RegistryView.Registry64, RegistryView.Registry32 };
            var hives = new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser };

            foreach (var hive in hives)
            {
                foreach (var view in views)
                {
                    try
                    {
                        using (var baseKey = RegistryKey.OpenBaseKey(hive, view))
                        using (var uninstallKey = baseKey.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall"))
                        {
                            if (uninstallKey == null) continue;

                            // Pass 1: exact match on DisplayName
                            foreach (var subKeyName in uninstallKey.GetSubKeyNames())
                            {
                                using (var subKey = uninstallKey.OpenSubKey(subKeyName))
                                {
                                    var displayName = subKey?.GetValue("DisplayName") as string;
                                    if (string.IsNullOrEmpty(displayName)) continue;
                                    if (string.Equals(displayName, appName, StringComparison.OrdinalIgnoreCase))
                                    {
                                        var path = ExtractInstallPathFromUninstallSubKey(subKey);
                                        if (!string.IsNullOrEmpty(path)) return path;
                                    }
                                }
                            }

                            // Pass 2: contains match on DisplayName
                            foreach (var subKeyName in uninstallKey.GetSubKeyNames())
                            {
                                using (var subKey = uninstallKey.OpenSubKey(subKeyName))
                                {
                                    var displayName = subKey?.GetValue("DisplayName") as string;
                                    if (string.IsNullOrEmpty(displayName)) continue;
                                    if (displayName.IndexOf(appName, StringComparison.OrdinalIgnoreCase) >= 0)
                                    {
                                        var path = ExtractInstallPathFromUninstallSubKey(subKey);
                                        if (!string.IsNullOrEmpty(path)) return path;
                                    }
                                }
                            }
                        }
                    }
                    catch
                    {
                        // Ignore and continue searching other registry views/hives
                    }
                }
            }

            return null;
        }

        private static string ExtractInstallPathFromUninstallSubKey(RegistryKey subKey)
        {
            if (subKey == null) return null;

            var installLocation = subKey.GetValue("InstallLocation") as string;
            if (!string.IsNullOrWhiteSpace(installLocation))
            {
                installLocation = Environment.ExpandEnvironmentVariables(installLocation.Trim().Trim('"'));
                if (Directory.Exists(installLocation))
                {
                    return installLocation;
                }
            }

            var displayIcon = subKey.GetValue("DisplayIcon") as string;
            var pathFromIcon = TryGetDirectoryFromExecutablePath(displayIcon);
            if (!string.IsNullOrEmpty(pathFromIcon)) return pathFromIcon;

            var uninstallString = subKey.GetValue("UninstallString") as string;
            var pathFromUninstall = TryGetDirectoryFromExecutablePath(uninstallString);
            if (!string.IsNullOrEmpty(pathFromUninstall)) return pathFromUninstall;

            return null;
        }

        private static string TryGetDirectoryFromExecutablePath(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;

            string exePath = value.Trim();

            // Extract the executable path without arguments
            if (exePath.StartsWith("\""))
            {
                int endQuote = exePath.IndexOf('"', 1);
                if (endQuote > 1)
                {
                    exePath = exePath.Substring(1, endQuote - 1);
                }
            }
            else
            {
                int spaceIndex = exePath.IndexOf(' ');
                if (spaceIndex > 0)
                {
                    exePath = exePath.Substring(0, spaceIndex);
                }
            }

            exePath = Environment.ExpandEnvironmentVariables(exePath);
            exePath = exePath.Trim().Trim('"');

            try
            {
                var dir = Path.GetDirectoryName(exePath);
                if (!string.IsNullOrEmpty(dir) && Directory.Exists(dir))
                {
                    return dir;
                }
            }
            catch
            {
                // ignore parsing issues
            }

            return null;
        }

        public static List<string> DeepScanNdfFiles(string rootDirectory)
        {
            List<string> ndfFiles = new List<string>();
            if (!Directory.Exists(rootDirectory))
            {
                return ndfFiles;
            }

            try
            {
                string[] filesInCurrent = Directory.GetFiles(rootDirectory, "*.ndf");
                ndfFiles.AddRange(filesInCurrent);
                string[] subDirectories = Directory.GetDirectories(rootDirectory);
                foreach (string subDir in subDirectories)
                {
                    List<string> filesInSubDir = DeepScanNdfFiles(subDir);
                    ndfFiles.AddRange(filesInSubDir);
                }
            }
            catch
            {
                //
            }

            return ndfFiles;
        }

        public static Tuple<FileType, int> CheckFileType(string filePath)
        {
            byte[] buffer = new byte[10];
            using (FileStream fs = new FileStream(filePath, FileMode.Open, FileAccess.Read))
            {
                int bytesRead = fs.Read(buffer, 0, buffer.Length);
                if (bytesRead < 4)
                    return Tuple.Create(FileType.Unknown, 0);
            }

            string hex = BitConverter.ToString(buffer).Replace("-", "").ToLower();

            if (hex.Contains("89504e470d0a1a0a")) // Offset: 0 bytes
                return Tuple.Create(FileType.PNG, 0);
            else if (hex.Contains("ffd8ff")) // Offset: 0 bytes
                return Tuple.Create(FileType.JPEG, 0);
            else if (hex.Contains("66747970")) // Offset: 4 bytes + 2 bytes (N0va Magic bytes) = 6 bytes
                return Tuple.Create(FileType.MP4, 2);
            else
                return Tuple.Create(FileType.Unknown, 0);
        }

        public static string ConvertFileTypeToString(FileType fileType)
        {
            switch (fileType)
            {
                case FileType.PNG:
                    return "png";
                case FileType.JPEG:
                    return "jpg";
                case FileType.MP4:
                    return "mp4";
                default:
                    return "unknown";
            }
        }

        public static string ConvertFile(string baseFolder, string fileSource, string folderSave, FileType fileType, int offset)
        {
            string normalizedBaseFolder = baseFolder.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            if (!fileSource.StartsWith(normalizedBaseFolder, StringComparison.OrdinalIgnoreCase))
            {
                throw new ArgumentException("fileSource must be contained within baseFolder.");
            }
            string relativePath = fileSource.Substring(normalizedBaseFolder.Length + 1);
            string relativeDirectory = Path.GetDirectoryName(relativePath);
            string destDirectory = Path.Combine(folderSave, relativeDirectory);
            Directory.CreateDirectory(destDirectory);
            string fileNameWithoutExt = Path.GetFileNameWithoutExtension(fileSource);
            string newExtension = ConvertFileTypeToString(fileType);
            string destFile = Path.Combine(destDirectory, fileNameWithoutExt + "." + newExtension);
            using (FileStream sourceStream = new FileStream(fileSource, FileMode.Open, FileAccess.Read))
            using (FileStream destStream = new FileStream(destFile, FileMode.Create, FileAccess.Write))
            {
                if (offset > 0)
                {
                    if (offset >= sourceStream.Length)
                        throw new ArgumentException("File length < offset");
                    sourceStream.Seek(offset, SeekOrigin.Begin);
                }
                sourceStream.CopyTo(destStream);
            }
            return destFile;
        }
    }
    public enum FileType
    {
        Unknown,
        PNG,
        JPEG,
        MP4
    }
}
