using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace N0vaDesktopFileConverter
{
    public partial class PreviewImage : Form
    {
        private MainForm mainForm;
        private NdfFileItem file = null;
        public PreviewImage(MainForm mainForm, NdfFileItem f)
        {
            InitializeComponent();
            this.mainForm = mainForm;
            this.file = f;
        }

        private void PreviewImage_Load(object sender, EventArgs e)
        {
            try
            {
                this.pictureBox.Image = Image.FromFile(file.Filename);
            } catch
            {
                this.Close();
            }
        }
    }
}
