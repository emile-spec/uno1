# Fjord UNO

Dansk online kortspil til 2–6 personer. Kræver Node.js 22 eller nyere; ingen eksterne pakker eller database.

## Spil med én pc som midlertidig server

1. Læg projektmappen på værtens pc, og installer Node.js 22 eller nyere fra https://nodejs.org. De andre pc'er behøver kun en browser.
2. På Windows: dobbeltklik på `Start-Uno.bat`. På Mac/Linux: åbn en terminal i projektmappen, og kør `sh start-uno.sh`.
3. Værten åbner `http://localhost:3000`. De andre åbner den adresse mærket **Andre på samme netværk**, som vises i terminalen, fx `http://192.168.1.42:3000`. Brug værtens adresse, ikke `localhost`, på de andre pc'er.
4. Alle logger ind med hvert sit navn og `FjordskolenKruså`. Én opretter et rum, deler rumkoden, og starter, når 2–6 spillere er med. Værts-pc'en kan også være spiller.
5. Lad terminalen være åben, og undgå at værtens pc går i dvale. Stop med Ctrl+C, når I er færdige. Spil og rum slettes ved stop.

Alle pc'er skal kunne nå hinanden på samme lokale netværk. Tillad Node.js på **private netværk** i Windows Firewall, hvis du bliver spurgt. Slå ikke hele firewallen fra. Skolers netværk og gæste-Wi-Fi kan have klientisolering, som forhindrer forbindelsen; brug et tilladt lokalt netværk, eller spørg netværksadministratoren. Ved flere viste IP-adresser vælges adressen til det netværk, spillerne deler.

### Hvis spillerne er på forskellige netværk

På Windows: dobbeltklik på **Start-Online.bat**. Første gang installerer filen Node.js LTS og Cloudflare Tunnel gennem Windows' `winget`, hvis de mangler. Det kan kræve installationsrettigheder. Værtens browser åbnes automatisk; kopiér den offentlige `https://….trycloudflare.com`-adresse fra tunnelvinduet, og send den til gæsterne. Log ind med `FjordskolenKruså`, opret et rum, og del rumkoden. Behold både server- og tunnelvinduet åbne. Adressen kan skifte ved hver opstart.

Start kun denne startfil én gang; en anden Uno-server på port 3000 skal stoppes først. Windows-opstarten og Cloudflares forbindelse skal afprøves på værtens pc. Skolens sikkerhedspolitik kan blokere installation eller tunneler; kontakt i så fald administratoren.

En lokal IP-adresse virker ikke på tværs af internettet. Værts-pc'en kan stadig være server, men kræver en HTTPS-tunnel til port 3000 eller routerens portviderestilling. Windows-startfilen ovenfor opretter tunnelen, når den køres på værtens pc. En HTTPS-tunnel anbefales frem for at eksponere ukrypteret HTTP. Brug en stærk `GAME_PASSWORD`, hvis serveren eksponeres offentligt. Værts-pc'en skal være tændt under hele spillet.

## Start fra terminal

```sh
npm start
```

Serveren lytter på `0.0.0.0:3000`. Åbn serverens adresse fra hver spillers browser. Log ind med et navn og adgangskoden `FjordskolenKruså`. En spiller opretter et rum og deler rumkoden med de andre. Værten starter spillet, når 2–6 spillere er tilmeldt. Brug separate browserprofiler til flere spillere på samme maskine.

## På internettet

Deploy projektet på en Node.js-host med én vedvarende serverinstans og HTTPS. Kør `npm start`; platformens `PORT` understøttes. Sæt `COOKIE_SECURE=1` ved HTTPS. En reverse proxy skal videresende `Host` og `X-Forwarded-Proto`, understøtte SSE og slå buffering fra for `/api/events`. Alle spillere bruger den samme offentlige adresse. Appen er ikke automatisk offentliggjort ved lokal opstart.

`GAME_PASSWORD` kan overskrive standardkoden. Indtast hemmelige indstillinger i hostingplatformen, ikke i Git. Standardkoden ligger i kildekoden og er fælles adgang, ikke personlige brugerkonti.

Rum, sessioner og spil gemmes i serverens hukommelse. En genstart nulstiller dem. En kort afbrydelse eller genindlæsning i samme browser gendanner hånden, så længe serveren kører. Forlader en spiller aktivt et igangværende spil, afsluttes runden, og værten kan starte igen. Spillets data deles ikke mellem flere serverinstanser.

## Regler og kontrol

7 tilfældige kort pr. spiller. Match farve eller værdi; træk ét kort, hvis du vil eller ikke kan spille. Et trukket, spilbart kort kan lægges straks, ellers kan du passe. Stop og vend retning understøttes; vend retning i et spil med to fungerer som stop. +2 og +4 giver næste spiller kort og springer deres tur over. Ingen stabling eller udfordring af +4. +4 kan kun bruges, hvis spilleren ikke har den aktuelle farve. UNO annonceres automatisk. En runde afgøres ved tom hånd; ingen pointturnering.

```sh
npm test
curl --fail http://127.0.0.1:3000/health
```

Serveren er autoritativ, validerer alle træk og sender kun hver spillers egen hånd. Tilfældig blanding bruger Node.js' kryptografiske tilfældighedskilde.
