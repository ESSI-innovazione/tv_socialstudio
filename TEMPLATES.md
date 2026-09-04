# Come si autora un template in Figma

Questo file è per il team marketing. Non serve saper programmare.

I template vivono nella libreria Figma **Time Vision Brand 2026**. Lo Studio li **legge e basta**: non
può modificarli, non può crearne. Chi cambia un template siete voi, in Figma. Lo Studio se ne accorge
alla sincronizzazione successiva.

## La regola in tre righe

1. Una **pagina** il cui nome inizia con `TPL/` è un template.
2. Dentro quella pagina, ogni **frame** si chiama come un formato.
3. Dentro ogni frame, ogni **livello di testo** si chiama come il suo ruolo.

## 1. La pagina

Il nome della pagina è `TPL/` seguito dal nome che comparirà nello Studio.

```
TPL/Bando con countdown
TPL/Corso e academy
```

Nello Studio si leggeranno «Bando con countdown» e «Corso e academy». Una pagina che non inizia con
`TPL/` viene ignorata: usatela pure per appunti, prove e scarti.

## 2. I frame

Dentro la pagina, un frame per formato. I nomi sono esatti, minuscoli, con il trattino.

| Nome del frame | Dimensione | A cosa serve |
|---|---|---|
| `poster-a4` | 794 × 1123 | Poster A4, esportato a 300 dpi per la stampa |
| `linkedin` | 1200 × 627 | Post immagine LinkedIn |
| `ig-feed` | 1080 × 1080 | Post quadrato Instagram |
| `ig-story` | 1080 × 1920 | Story Instagram |

**`poster-a4` è obbligatorio.** È il formato di riferimento da cui derivano gli altri. Un template
senza non viene accettato, e la sincronizzazione ve lo dice per nome.

Gli altri tre sono facoltativi. Un template solo per la stampa è legittimo.

## 3. I livelli di testo

Il nome del livello dice **che ruolo ha**, non cosa c'è scritto. Il testo dentro al livello in Figma è
solo un segnaposto: lo Studio lo sostituisce con il testo della campagna.

| Nome del livello | Cosa ci finisce |
|---|---|
| `headline` | Il titolo. Il dato che ferma lo sguardo |
| `subhead` | Il sottotitolo, che completa il titolo |
| `body` | Il paragrafo di spiegazione |
| `eyebrow` | L'occhiello sopra il titolo, es. `MIMIT · MISURA 2026` |
| `deadline` | La banda della scadenza, es. `CLICK-DAY 10 NOVEMBRE 2026 · ORE 12:00` |
| `cta` | La chiamata all'azione e il suo indirizzo |
| `disclaimer` | Il testo legale in calce, obbligatorio sui bandi |

Un livello di testo con un nome diverso **ferma la sincronizzazione** con un errore che vi dice quale
livello e in quale frame. È voluto: un livello battezzato a modo proprio resterebbe vuoto sull'asset
finale, e ve ne accorgereste dopo la pubblicazione.

### Dire quanto testo entra

Aggiungete `@` e un numero al nome per dichiarare quanti caratteri stanno in quel riquadro senza che
l'impaginazione si rompa.

```
headline@48
body@220
```

Significa: il titolo regge fino a 48 caratteri, il paragrafo fino a 220. Lo Studio lo passa a chi
scrive il testo, così il copy nasce già della lunghezza giusta.

Senza il suffisso lo Studio stima il limite dalla dimensione del riquadro. Funziona, ma la vostra
stima è migliore della sua: mettetelo.

## 4. Immagine e marchio

| Nome del livello | Cosa fa |
|---|---|
| `image` o `photo` | Il riquadro dove va la fotografia. Posizione e dimensione sono quelle che disegnate |
| `logo` o `marchio` | Dove sta il marchio Time Vision, e di che colore |

Il marchio è obbligatorio in ogni frame. Un frame senza `logo` non viene accettato.

## 5. Cosa viene letto e cosa no

Dello sfondo, dei testi e dei riquadri lo Studio legge i valori **esatti** che avete impostato:
posizione, dimensione del corpo, peso, interlinea, spaziatura fra le lettere, colore. Non arrotonda
niente a una griglia. Un titolo a 47,5 px resta a 47,5 px.

Quello che lo Studio **non** legge: effetti, ombre, maschere, componenti annidati, auto-layout. Se un
template dipende da uno di questi per stare in piedi, l'asset finale non gli somiglierà. Tenete i
frame semplici: un fondo, dei testi, un riquadro foto, il marchio.

## 6. Quando avete finito

Nello Studio, premete **Sincronizza**. La sincronizzazione è manuale apposta: Figma limita quante
richieste si possono fare, e lo Studio legge la libreria solo quando glielo chiedete.

Se qualcosa non va, l'errore dice il nome del template e il problema. I tre più frequenti:

- manca il frame `poster-a4`
- un livello di testo ha un nome che non è nell'elenco dei ruoli
- un frame non ha il livello `logo`
