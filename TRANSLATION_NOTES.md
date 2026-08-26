# Translation notes — Emoji Blaster

Provenance for every hand-overridden string in `public/locales/*.overrides.json`.

**Nothing here has been checked by a native speaker.** Every row was written by
Claude from inspection of the DeepL output; `Status` records that.

Total overridden: **49** of 265 strings (53 keys x 5 languages).

## Built on the existing scaffolding, not over it

`245e362` already added `public/i18n.js` and `i18n-source/en.json`. **All 53
keys and every English string are kept exactly as written there** — the key
names were already good and are unchanged. Only the loading mechanism was
replaced, because the original could not meet the contract: it resolved
`uiLang` without normalizing (so `?uiLang=PT-BR` and a bare `pt` both failed),
and it decided language availability from a baked-in object rather than from
which locale files exist.

The two-copies problem had already bitten: the inline table had drifted to **53
keys while `i18n-source/en.json` still had 51**, missing `copy_invite_button`
and `invite_link_copied`. The live table won, and there is now one file.

| Lang | Key | Why | Replacement | Status |
|---|---|---|---|---|
| `fr` | `back_to_launchpad` | Adopted Sid's shorter arcade phrasing, already used in the other games; the long form overflows its button at 375px. | `RETOUR À LA BASE` | claude-corrected, unverified |
| `fr` | `loading` | Matches the shorter form used elsewhere in the suite. | `CHARGEMENT` | claude-corrected, unverified |
| `fr` | `username_placeholder` | Formal register; house style is informal (tu/tú/ты). | `Ton nom` | claude-corrected, unverified |
| `fr` | `join_room_button` | Rendered as "join **us**" (`Rejoignez-nous`, `Junte-se a nós`) -- you join a room, not the team. | `Rejoindre` | claude-corrected, unverified |
| `fr` | `ready_up_button` | Imperative with added punctuation where a button label was wanted. | `Je suis prêt` | claude-corrected, unverified |
| `fr` | `cancel_ready_button` | **Meaning inverted**: `Prêt à annuler` / `Listo para cancelar` = "ready to cancel". The button un-readies you. | `Annuler` | claude-corrected, unverified |
| `fr` | `start_now_button` | Three times the English; overflows. | `Commencer` | claude-corrected, unverified |
| `fr` | `emoji_correct` | **Wrong sense in all five.** "got it" was read as comprehension (`D'accord`, `Ya lo pillo`, `Entendi`, `Понял`) rather than guessed correctly. | `{username} a trouvé ! (« {guess} »)` | claude-corrected, unverified |
| `fr` | `sync_progress` | pt-br left the word `players` untranslated; es used the Spain-only `seguid` imperative; ru had the wrong case. | `Meilleure correspondance : {bestCount}/{required} joueurs — continue à taper des mots !` | claude-corrected, unverified |
| `fr` | `consensus_locked_hint` | **Placeholder read as a name in all five** -- `joueurs d'{required}`, `jugadores de {required}`, and Russian `игроки с{required}` with the space dropped too. | `Il faut {required} joueurs dans le salon pour choisir ce niveau` | claude-corrected, unverified |
| `fr` | `game_over_summary` | The score was read as an identifier rather than a count: `el emoji {teamScore}`, `um emoji {teamScore}`, `нажала на смайлик {teamScore}`. | `Temps écoulé ! Ton équipe a synchronisé {teamScore} emojis.` | claude-corrected, unverified |
| `fr` | `name_required_error` | Formal register; house style is informal (tu/tú/ты). | `Entre d'abord un nom.` | claude-corrected, unverified |
| `fr` | `room_code_required_error` | Formal register; house style is informal (tu/tú/ты). | `Entre un code de salon.` | claude-corrected, unverified |
| `fr` | `guess_placeholder` | Formal register; house style is informal (tu/tú/ты). | `Tape le mot-clé et appuie sur Entrée…` | claude-corrected, unverified |
| `es` | `back_to_launchpad` | Adopted Sid's shorter arcade phrasing, already used in the other games; the long form overflows its button at 375px. | `VOLVER A LA BASE` | claude-corrected, unverified |
| `es` | `join_room_button` | Rendered as "join **us**" (`Rejoignez-nous`, `Junte-se a nós`) -- you join a room, not the team. | `Entrar` | claude-corrected, unverified |
| `es` | `cancel_ready_button` | **Meaning inverted**: `Prêt à annuler` / `Listo para cancelar` = "ready to cancel". The button un-readies you. | `Cancelar` | claude-corrected, unverified |
| `es` | `play_again_button` | `Volver a reproducir` is replaying a *video*. | `Volver a jugar` | claude-corrected, unverified |
| `es` | `emoji_correct` | **Wrong sense in all five.** "got it" was read as comprehension (`D'accord`, `Ya lo pillo`, `Entendi`, `Понял`) rather than guessed correctly. | `¡{username} lo ha acertado! («{guess}»)` | claude-corrected, unverified |
| `es` | `sync_progress` | pt-br left the word `players` untranslated; es used the Spain-only `seguid` imperative; ru had the wrong case. | `Mejor coincidencia: {bestCount}/{required} jugadores — ¡sigue escribiendo palabras!` | claude-corrected, unverified |
| `es` | `consensus_locked_hint` | **Placeholder read as a name in all five** -- `joueurs d'{required}`, `jugadores de {required}`, and Russian `игроки с{required}` with the space dropped too. | `Se necesitan {required} jugadores en la sala para elegir este nivel` | claude-corrected, unverified |
| `es` | `game_over_summary` | The score was read as an identifier rather than a count: `el emoji {teamScore}`, `um emoji {teamScore}`, `нажала на смайлик {teamScore}`. | `¡Se acabó el tiempo! Tu equipo ha sincronizado {teamScore} emojis.` | claude-corrected, unverified |
| `pt-br` | `back_to_launchpad` | Adopted Sid's shorter arcade phrasing, already used in the other games; the long form overflows its button at 375px. | `VOLTAR À BASE` | claude-corrected, unverified |
| `pt-br` | `join_room_button` | Rendered as "join **us**" (`Rejoignez-nous`, `Junte-se a nós`) -- you join a room, not the team. | `Entrar` | claude-corrected, unverified |
| `pt-br` | `cancel_ready_button` | **Meaning inverted**: `Prêt à annuler` / `Listo para cancelar` = "ready to cancel". The button un-readies you. | `Cancelar` | claude-corrected, unverified |
| `pt-br` | `emoji_correct` | **Wrong sense in all five.** "got it" was read as comprehension (`D'accord`, `Ya lo pillo`, `Entendi`, `Понял`) rather than guessed correctly. | `{username} acertou! (“{guess}”)` | claude-corrected, unverified |
| `pt-br` | `sync_progress` | pt-br left the word `players` untranslated; es used the Spain-only `seguid` imperative; ru had the wrong case. | `Melhor correspondência: {bestCount}/{required} jogadores — continue digitando palavras!` | claude-corrected, unverified |
| `pt-br` | `consensus_locked_hint` | **Placeholder read as a name in all five** -- `joueurs d'{required}`, `jugadores de {required}`, and Russian `игроки с{required}` with the space dropped too. | `São necessários {required} jogadores na sala para escolher este nível` | claude-corrected, unverified |
| `pt-br` | `game_over_summary` | The score was read as an identifier rather than a count: `el emoji {teamScore}`, `um emoji {teamScore}`, `нажала на смайлик {teamScore}`. | `O tempo acabou! Sua equipe sincronizou {teamScore} emojis.` | claude-corrected, unverified |
| `pt-pt` | `back_to_launchpad` | Adopted Sid's shorter arcade phrasing, already used in the other games; the long form overflows its button at 375px. | `VOLTAR À BASE` | claude-corrected, unverified |
| `pt-pt` | `join_room_button` | Rendered as "join **us**" (`Rejoignez-nous`, `Junte-se a nós`) -- you join a room, not the team. | `Entrar` | claude-corrected, unverified |
| `pt-pt` | `cancel_ready_button` | **Meaning inverted**: `Prêt à annuler` / `Listo para cancelar` = "ready to cancel". The button un-readies you. | `Cancelar` | claude-corrected, unverified |
| `pt-pt` | `play_again_button` | `Volver a reproducir` is replaying a *video*. | `Jogar de novo` | claude-corrected, unverified |
| `pt-pt` | `emoji_correct` | **Wrong sense in all five.** "got it" was read as comprehension (`D'accord`, `Ya lo pillo`, `Entendi`, `Понял`) rather than guessed correctly. | `{username} acertou! («{guess}»)` | claude-corrected, unverified |
| `pt-pt` | `sync_progress` | pt-br left the word `players` untranslated; es used the Spain-only `seguid` imperative; ru had the wrong case. | `Melhor correspondência: {bestCount}/{required} jogadores — continua a escrever palavras!` | claude-corrected, unverified |
| `pt-pt` | `consensus_locked_hint` | **Placeholder read as a name in all five** -- `joueurs d'{required}`, `jugadores de {required}`, and Russian `игроки с{required}` with the space dropped too. | `São precisos {required} jogadores na sala para escolher este nível` | claude-corrected, unverified |
| `pt-pt` | `game_over_summary` | The score was read as an identifier rather than a count: `el emoji {teamScore}`, `um emoji {teamScore}`, `нажала на смайлик {teamScore}`. | `Acabou o tempo! A tua equipa sincronizou {teamScore} emojis.` | claude-corrected, unverified |
| `ru` | `back_to_launchpad` | Adopted Sid's shorter arcade phrasing, already used in the other games; the long form overflows its button at 375px. | `ВЕРНУТЬСЯ НА БАЗУ` | claude-corrected, unverified |
| `ru` | `username_placeholder` | Formal register; house style is informal (tu/tú/ты). | `Твоё имя` | claude-corrected, unverified |
| `ru` | `join_room_button` | Rendered as "join **us**" (`Rejoignez-nous`, `Junte-se a nós`) -- you join a room, not the team. | `Войти` | claude-corrected, unverified |
| `ru` | `ready_up_button` | Imperative with added punctuation where a button label was wanted. | `Я готов` | claude-corrected, unverified |
| `ru` | `cancel_ready_button` | **Meaning inverted**: `Prêt à annuler` / `Listo para cancelar` = "ready to cancel". The button un-readies you. | `Отменить готовность` | claude-corrected, unverified |
| `ru` | `emoji_correct` | **Wrong sense in all five.** "got it" was read as comprehension (`D'accord`, `Ya lo pillo`, `Entendi`, `Понял`) rather than guessed correctly. | `{username} угадал(а)! («{guess}»)` | claude-corrected, unverified |
| `ru` | `sync_progress` | pt-br left the word `players` untranslated; es used the Spain-only `seguid` imperative; ru had the wrong case. | `Лучшее совпадение: {bestCount}/{required} игроков — продолжай вводить слова!` | claude-corrected, unverified |
| `ru` | `consensus_locked_hint` | **Placeholder read as a name in all five** -- `joueurs d'{required}`, `jugadores de {required}`, and Russian `игроки с{required}` with the space dropped too. | `Чтобы выбрать этот уровень, в комнате нужно {required} игроков` | claude-corrected, unverified |
| `ru` | `game_over_summary` | The score was read as an identifier rather than a count: `el emoji {teamScore}`, `um emoji {teamScore}`, `нажала на смайлик {teamScore}`. | `Время вышло! Твоя команда синхронизировала {teamScore} эмодзи.` | claude-corrected, unverified |
| `ru` | `name_required_error` | Formal register; house style is informal (tu/tú/ты). | `Сначала введи имя.` | claude-corrected, unverified |
| `ru` | `room_code_required_error` | Formal register; house style is informal (tu/tú/ты). | `Введи код комнаты.` | claude-corrected, unverified |
| `ru` | `guess_placeholder` | Formal register; house style is informal (tu/tú/ты). | `Введи ключевое слово и нажми Enter…` | claude-corrected, unverified |

## Numeric exemptions

`consensus_desc_level1` and `consensus_desc_level2` are listed in
`public/locales/numeric-exempt.json`. Spanish and Portuguese spell small
numbers out in prose — "2 players" becomes "dos jugadores" — so the figure
stops being a figure while the threshold stays identical. Verified against the
English, and the exemption carries its reason in the file.

## Reviewed / not reviewed

All 265 strings were read once against their English, prioritising meaning
(inverted buttons, placeholders rendering as names) over idiom. Idiomatic
quality beyond that is unexamined.
