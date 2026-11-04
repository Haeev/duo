import json, sys
# Prises de la planche: deux listes (serveur ancien, serveur neuf).
STATES = [
    ('a-012', 5949, 'facettes'),
    ('b-neuf-facettes', 5948, 'facettes'),
    ('c-ancien-lisse', 5949, 'lisse'),
    ('d-neuf-lisse', 5948, 'lisse'),
]
RES = [('1366', 1366, 768), ('1920', 1920, 1080)]
HOURS = [('jour', '15:00'), ('soir', '17:45')]
lists = {5948: [], 5949: []}
for name, port, style in STATES:
    for rname, w, h in RES:
        for z in ('0', '1'):
            for hname, hour in HOURS:
                lists[port].append({
                    'name': f'{name}-{rname}-z{z}-{hname}',
                    'base': f'http://127.0.0.1:{port}/',
                    'width': w, 'height': h, 'steps': 30, 'dt': 0.1,
                    'q': {'temoins': '1', 'style': style, 'zoom': z, 'heure': hour, 'vue': '38.3,30.7'},
                })
for port, shots in lists.items():
    json.dump(shots, open(f'{sys.argv[1]}/prises-{port}.json', 'w'), indent=1)
    print(port, len(shots))
