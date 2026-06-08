@echo off
set PATH=%PATH%;C:\Program Files\nodejs
echo Rodando TypeScript Compiler Check...
call "C:\Program Files\nodejs\npm.cmd" run lint
