$ErrorActionPreference = 'Stop'
$utf8 = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = [Windows.Forms.Form]::new()
$form.Text = 'DSH Bridge'
$form.StartPosition = 'CenterScreen'
$form.ClientSize = [Drawing.Size]::new(680, 480)
$form.MinimumSize = $form.Size
$form.TopMost = $true

$label = [Windows.Forms.Label]::new()
$label.SetBounds(12, 12, 650, 68)
if ($request.direction -eq 'to-dsh') {
    $label.Text = "Review and edit the prompt before sending it to DSH.`r`nSession: $($request.alias) / $($request.sessionId)`r`nFolder: $($request.cwd)"
    $buttonText = 'Approve and send'
} else {
    $label.Text = "Edit the reply to keep only the text you want to return to this Work thread.`r`nSession: $($request.alias) / $($request.sessionId)`r`nFolder: $($request.cwd)"
    $buttonText = 'Approve and return'
}

$text = [Windows.Forms.TextBox]::new()
$text.SetBounds(12, 86, 656, 335)
$text.Anchor = 'Top, Bottom, Left, Right'
$text.Multiline = $true
$text.AcceptsReturn = $true
$text.ScrollBars = 'Vertical'
$text.Font = [Drawing.Font]::new('Segoe UI', 11)
$text.MaxLength = 16000
$text.Text = $request.text

$approve = [Windows.Forms.Button]::new()
$approve.SetBounds(370, 435, 160, 32)
$approve.Anchor = 'Bottom, Right'
$approve.Text = $buttonText
$approve.Add_Click({
    if (![string]::IsNullOrWhiteSpace($text.Text) -and $text.Text.Length -le 16000) {
        $form.DialogResult = 'OK'
    }
})

$cancel = [Windows.Forms.Button]::new()
$cancel.SetBounds(544, 435, 124, 32)
$cancel.Anchor = 'Bottom, Right'
$cancel.Text = 'Cancel'
$cancel.DialogResult = 'Cancel'
$form.CancelButton = $cancel
$form.Controls.AddRange(@($label, $text, $approve, $cancel))
try {
    if ($form.ShowDialog() -ne 'OK') { exit 2 }
    [Console]::Out.Write((ConvertTo-Json -InputObject $text.Text -Compress))
} finally {
    $form.Dispose()
}
