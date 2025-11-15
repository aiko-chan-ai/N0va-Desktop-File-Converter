using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;

namespace N0vaDesktopFileConverter
{
    public static class Win32API
    {
        [DllImport("user32.dll")]
        static public extern bool HideCaret(IntPtr hWnd);
    }
}
