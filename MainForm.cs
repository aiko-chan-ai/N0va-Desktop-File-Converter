using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Policy;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace N0vaDesktopFileConverter
{
    public partial class MainForm : Form
    {
        public MainForm()
        {
            InitializeComponent();
        }

        private void MainForm_Load(object sender, EventArgs e)
        {
            Win32API.HideCaret(inpFilePath.Handle);
            Win32API.HideCaret(inpFolderSave.Handle);
            inpFilePath.Text = Utils.FindInstallPath("N0va Desktop");

            dgvFiles.Columns.Add(new DataGridViewTextBoxColumn()
            {
                HeaderText = "Path",
                Name = "ColFilename",
                DataPropertyName = "Filename"
            });

            dgvFiles.Columns.Add(new DataGridViewTextBoxColumn()
            {
                HeaderText = "Type",
                Name = "ColDetectedType",
                DataPropertyName = "DetectedType",
                AutoSizeMode = DataGridViewAutoSizeColumnMode.ColumnHeader,
            });

            dgvFiles.Columns.Add(new DataGridViewTextBoxColumn()
            {
                HeaderText = "Size (MB)",
                Name = "ColFileSize",
                DataPropertyName = "FileSize",
                AutoSizeMode = DataGridViewAutoSizeColumnMode.ColumnHeader,
            });

            dgvFiles.Columns.Add(new DataGridViewCheckBoxColumn()
            {
                HeaderText = "Convert",
                Name = "ColConvert",
                DataPropertyName = "Convert",
                AutoSizeMode = DataGridViewAutoSizeColumnMode.ColumnHeader,
            });

            dgvFiles.AutoGenerateColumns = false;
        }

        private void inpFilePath_DoubleClick(object sender, EventArgs e)
        {
            var openFileDialog = new OpenFileDialog();
            openFileDialog.Title = "Select the N0vaDesktop.exe executable file";
            openFileDialog.Filter = "N0va Desktop|N0vaDesktop.exe";
            if (openFileDialog.ShowDialog() == DialogResult.OK)
            {
                string folderPath = Path.GetDirectoryName(openFileDialog.FileName);
                inpFilePath.Text = folderPath;
            }
        }

        private void inpFolderSave_MouseDoubleClick(object sender, MouseEventArgs e)
        {
            var openFolderDialog = new FolderBrowserDialog();
            openFolderDialog.Description = "Select the folder to save files";
            if (openFolderDialog.ShowDialog() == DialogResult.OK)
            {
                inpFolderSave.Text = openFolderDialog.SelectedPath;
            }
        }

        private void dgvFiles_CellDoubleClick(object sender, DataGridViewCellEventArgs e)
        {
            if (e.RowIndex >= 0)
            {
                int rowIndex = e.RowIndex;
                var selectedItem = dgvFiles.Rows[rowIndex].DataBoundItem as NdfFileItem;
                if (selectedItem != null)
                {
                    if (selectedItem.RawType != FileType.MP4)
                    {
                        var formPreview = new PreviewImage(this, selectedItem);
                        formPreview.ShowDialog();
                    } else
                    {
                        // Convert
                        var path = Utils.ConvertFile(Path.Combine(inpFilePath.Text, "N0vaDesktopCache"), selectedItem.Filename, inpFolderSave.Text, selectedItem.RawType, selectedItem.Offset);
                        MessageBox.Show("Converted: " + path, this.Text, MessageBoxButtons.OK, MessageBoxIcon.Information);
                    }
                }
            }
        }

        private void repoToolStripMenuItem_Click(object sender, EventArgs e)
        {
            try
            {
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "https://github.com/aiko-chan-ai/N0va-Desktop-File-Converter",
                    UseShellExecute = true
                });
            }
            catch { }
        }

        private bool CheckFolder()
        {
            if (!Directory.Exists(inpFilePath.Text))
            {
                MessageBox.Show("The specified N0va Desktop folder does not exist.", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return false;
            };
            if (!Directory.Exists(inpFolderSave.Text))
            {
                MessageBox.Show("The specified save folder does not exist.", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return false;
            };
            return true;
        }

        private void btnScan_Click(object sender, EventArgs e)
        {
            if (!CheckFolder()) return;
            toolStripStatusMessage.Text = "Processing files...";
            statusStrip.Refresh();
            btnScan.Enabled = false;
            List<NdfFileItem> fileList = new List<NdfFileItem>();
            var ndfFiles = Utils.DeepScanNdfFiles(Path.Combine(inpFilePath.Text, "N0vaDesktopCache"));
            toolStripProgressBar.Visible = true;
            toolStripProgressBar.Maximum = ndfFiles.Count;
            toolStripProgressBar.Value = 0;
            foreach (var ndfFile in ndfFiles)
            {
                var fileInfo = new FileInfo(ndfFile);
                var fileTypeInfo = Utils.CheckFileType(ndfFile);
                if (fileTypeInfo.Item1 == FileType.Unknown)
                {
                    toolStripProgressBar.Value += 1;
                    continue;
                }
                fileList.Add(new NdfFileItem()
                {
                    Filename = ndfFile,
                    DetectedType = Utils.ConvertFileTypeToString(fileTypeInfo.Item1),
                    RawType = fileTypeInfo.Item1,
                    Offset = fileTypeInfo.Item2,
                    FileSize = ((double)fileInfo.Length / (1024 * 1024)).ToString("F2"),
                    Convert = true
                });
                toolStripProgressBar.Value += 1;
            }
            dgvFiles.DataSource = fileList;
            toolStripStatusMessage.Text = "Ready";
            toolStripProgressBar.Visible = false;
            btnScan.Enabled = true;
            if (fileList.Count > 0) btnConvert.Enabled = true;
        }

        private void btnConvert_Click(object sender, EventArgs e)
        {
            if (!CheckFolder()) return;
            toolStripStatusMessage.Text = "Converting files...";
            statusStrip.Refresh();
            btnConvert.Enabled = false;
            toolStripProgressBar.Visible = true;
            toolStripProgressBar.Maximum = dgvFiles.Rows.Count;
            toolStripProgressBar.Value = 0;
            foreach (DataGridViewRow row in dgvFiles.Rows)
            {
                NdfFileItem file = row.DataBoundItem as NdfFileItem;
                bool isChecked = (bool)row.Cells["ColConvert"].Value;
                if (isChecked)
                {
                    var path = Utils.ConvertFile(Path.Combine(inpFilePath.Text, "N0vaDesktopCache"), file.Filename, inpFolderSave.Text, file.RawType, file.Offset);
                    Debug.WriteLine("Converted: " + path);
                }
                toolStripProgressBar.Value += 1;
            }

            toolStripStatusMessage.Text = "Ready";
            toolStripProgressBar.Visible = false;
            btnConvert.Enabled = true;
            // Open Explorer
            Process.Start(inpFolderSave.Text);
            MessageBox.Show("Conversion successful", this.Text, MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
    }
    public class NdfFileItem
    {
        public string Filename { get; set; }
        public string DetectedType { get; set; }

        public FileType RawType { get; set; }
        public string FileSize { get; set; }
        public bool Convert { get; set; }
        public int Offset { get; set; }
    }
}
