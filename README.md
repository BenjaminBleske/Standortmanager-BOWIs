https://ion.cesium.com/stories/viewer/?id=ec796444-2e3f-449f-a7e6-59e7a92c7f06

Npm install

npm install dotenv

nohup node server.js &
disown


5. Prozess beenden
Wenn du den Prozess später beenden möchtest, finde zuerst die PID (Process ID):

ps aux | grep node
Suche die Zeile mit deinem server.js, z. B.:

benjamin 12345  ... node server.js
Beende dann mit:

kill 12345
(Die Zahl ist die PID.)