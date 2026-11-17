param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$')]
    [string] $SessionId
)
$ErrorActionPreference = 'Stop'
$utf8 = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
$prompt = [Console]::In.ReadToEnd()
$dsh = Get-Command dsh -CommandType Application -ErrorAction Stop | Select-Object -First 1
$prompt | & $dsh.Source --profile headless --session-id $SessionId --permission-mode read-only --approval-policy never -
exit $LASTEXITCODE
