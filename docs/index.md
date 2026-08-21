# lol-stats

A local-only web application for analyzing my own League of Legends ranked
match history (NA region).

It stores my match history in a local SQLite database and displays aggregate
statistics: win rate by champion and by role, damage per minute, CS per minute,
KDA, gold share, and how these evolve across seasons. It can also compare my
aggregate statistics against another player's.

The application is not hosted anywhere. It binds to 127.0.0.1 and is used by
me alone. No user accounts, no advertising, no public access.

Riot APIs used: account-v1, match-v5 (queues 420 and 440), league-v4.
Static game data from Data Dragon.