' CHPLAYER — cópia comentada para estudo.
' Arquivo: 02-aplicativos/roku/components/UpdateController.brs
' Responsabilidade: Coordena o diálogo de atualização e a tela com endereço/QR, respeitando a reprodução.
' Este script é incluído por componentes ou pelo ponto de entrada. Busque seu nome nos XML para localizar os consumidores.
' Veja docs/architecture.md para eventos, campos e navegação.

' ------------------------------------------------------------
' initPlatformUpdates: Rotina initPlatformUpdates. A assinatura abaixo mostra os valores recebidos; os campos m.top conectam esta rotina aos outros componentes.
' Entrada(s): nenhum argumento explícito.
' Uso: procure este nome no XML, em observeField ou nos chamadores BrightScript.
sub initPlatformUpdates()
    m.pendingUpdate = invalid
    m.dismissedUpdate = ""
    m.updateTask = m.top.findNode("updateTask")
    m.updateTask.observeField("result", "updateAvailable")
    m.top.findNode("updateTimer").observeField("fire", "checkPlatformUpdate")
    m.top.findNode("updateTimer").control = "start"
    m.top.findNode("updateCodeClose").observeField("buttonSelected", "closeUpdateCode")
    checkPlatformUpdate()
end sub

' ------------------------------------------------------------
' checkPlatformUpdate: Inicia a consulta de versão publicada para o Roku.
' Entrada(s): nenhum argumento explícito.
' Uso: procure este nome no XML, em observeField ou nos chamadores BrightScript.
sub checkPlatformUpdate()
    if m.updateTask.state <> "RUN" then m.updateTask.control = "run"
end sub

' ------------------------------------------------------------
' updateAvailable: Recebe o resultado da consulta de atualização.
' Entrada(s): nenhum argumento explícito.
' Uso: procure este nome no XML, em observeField ou nos chamadores BrightScript.
sub updateAvailable()
    m.pendingUpdate = m.updateTask.result
    maybeShowPlatformUpdate()
end sub

' ------------------------------------------------------------
' maybeShowPlatformUpdate: Exibe o aviso somente quando não interrompe a reprodução.
' Entrada(s): nenhum argumento explícito.
' Uso: procure este nome no XML, em observeField ou nos chamadores BrightScript.
sub maybeShowPlatformUpdate()
    if m.pendingUpdate = invalid or m.accessActive <> true then return
    if m.pendingUpdate.version = m.dismissedUpdate then return
    if m.currentScreenName = "player" or m.currentScreenName = "live" then return
    if m.top.dialog <> invalid then return
    if m.top.findNode("updateCode").visible then return
    dialog = CreateObject("roSGNode", "Dialog")
    dialog.title = "Nova versão para Roku"
    dialog.message = "CHPlayer " + m.pendingUpdate.version + " está disponível para este aparelho."
    dialog.buttons = ["Atualizar", "Fechar"]
    dialog.observeField("buttonSelected", "platformUpdateSelected")
    m.top.dialog = dialog
end sub

' ------------------------------------------------------------
' platformUpdateSelected: Trata Atualizar/Fechar no aviso de versão.
' Entrada(s): nenhum argumento explícito.
' Uso: procure este nome no XML, em observeField ou nos chamadores BrightScript.
sub platformUpdateSelected()
    selected = m.top.dialog.buttonSelected
    m.dismissedUpdate = m.pendingUpdate.version
    m.top.dialog = invalid
    if selected = 0
        m.top.findNode("updateCode").visible = true
        m.top.findNode("updateCodeClose").setFocus(true)
    else if m.currentScreenNode <> invalid
        m.currentScreenNode.setFocus(true)
    end if
end sub

' ------------------------------------------------------------
' closeUpdateCode: Rotina closeUpdateCode. A assinatura abaixo mostra os valores recebidos; os campos m.top conectam esta rotina aos outros componentes.
' Entrada(s): nenhum argumento explícito.
' Uso: procure este nome no XML, em observeField ou nos chamadores BrightScript.
sub closeUpdateCode()
    m.top.findNode("updateCode").visible = false
    if m.currentScreenNode <> invalid then m.currentScreenNode.setFocus(true)
end sub
