The file people.csv is extracted from the official FCC database.  It's not kept up to date (yet):
https://gemini.google.com/share/ba650ac6d732

Used:
```
mpayne@data:~/DBs$ sqlite3 fcc_amateur.db
SQLite version 3.40.1 2022-12-28 14:03:47
Enter ".help" for usage hints.
sqlite> .headers on
sqlite> .mode csv
sqlite> .output b.csv
sqlite> SELECT en.call_sign, en.first_name, en.last_name
FROM en
JOIN hd ON en.unique_system_identifier = hd.unique_system_identifier
WHERE hd.license_status = 'A'
AND hd.radio_service_code = 'HA';
sqlite> .quit
```

