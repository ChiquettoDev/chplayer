' CHPLAYER — cópia comentada para estudo.
' Arquivo: 02-aplicativos/roku/components/UpdateTask.brs
' Responsabilidade: Consulta o manifesto remoto e compara a versão do Roku.
' O XML com o mesmo nome declara os campos de entrada/saída e importa este script.
' Veja docs/architecture.md para eventos, campos e navegação.

' ------------------------------------------------------------
' init: Inicializa referências e observadores do componente SceneGraph. O Roku chama init ao criar o nó.
' Entrada(s): nenhum argumento explícito.
' Uso: procure este nome no XML, em observeField ou nos chamadores BrightScript.
sub init()
    m.top.functionName = "checkUpdate"
end sub

' ------------------------------------------------------------
' updateNewer: Rotina updateNewer. A assinatura abaixo mostra os valores recebidos; os campos m.top conectam esta rotina aos outros componentes.
' Entrada(s): version as String, current as String.
' Uso: procure este nome no XML, em observeField ou nos chamadores BrightScript.
function updateNewer(version as String, current as String) as Boolean
    pattern = CreateObject("roRegex", "^[0-9]+[.][0-9]+[.][0-9]+$", "")
    if not pattern.IsMatch(version) or not pattern.IsMatch(current) then return false
    a = version.Split(".")
    b = current.Split(".")
    for i = 0 to 2
        if a[i].ToInt() <> b[i].ToInt() then return a[i].ToInt() > b[i].ToInt()
    end for
    return false
end function

' ------------------------------------------------------------
' checkUpdate: Rotina checkUpdate. A assinatura abaixo mostra os valores recebidos; os campos m.top conectam esta rotina aos outros componentes.
' Entrada(s): nenhum argumento explícito.
' Uso: procure este nome no XML, em observeField ou nos chamadores BrightScript.
sub checkUpdate()
    transfer = CreateObject("roUrlTransfer")
    transfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
    transfer.InitClientCertificates()
    transfer.SetUrl("https://chplayer.example.com/updates/releases.json")
    port = CreateObject("roMessagePort")
    transfer.SetPort(port)
    if not transfer.AsyncGetToString() then return
    message = wait(15000, port)
    if message = invalid
        transfer.AsyncCancel()
        return
    end if
    if message.GetResponseCode() <> 200 then return
    text = message.GetString()
    if Len(text) > 131072 then return
    releases = ParseJson(text)
    if releases = invalid or releases.roku = invalid then return
    release = releases.roku
    if type(release.version) <> "String" and type(release.version) <> "roString" then return
    info = CreateObject("roAppInfo")
    current = info.GetVersion()
    if updateNewer(release.version, current) then m.top.result = release
end sub
