import json, sys
CENTRE = sys.argv[2] if len(sys.argv) > 2 else '46.2,27.0'
VUE = sys.argv[3] if len(sys.argv) > 3 else '45.9,26.7'
STATES = [('a-012', 5949, 'facettes'), ('b-neuf-facettes', 5948, 'facettes'), ('c-ancien-lisse', 5949, 'lisse'), ('d-neuf-lisse', 5948, 'lisse')]
lists = {5948: [], 5949: []}
for name, port, style in STATES:
    for z in ('0', '1'):
        lists[port].append({'name': f'{name}-1366-z{z}-soleil', 'base': f'http://127.0.0.1:{port}/', 'width': 1366, 'height': 768,
                            'steps': 30, 'dt': 0.1,
                            'q': {'temoins': '1', 'temoins_centre': CENTRE, 'style': style, 'zoom': z, 'heure': '17:45', 'vue': VUE}})
# Marche: contour en mouvement (style lisse, nouveaux modèles, puis anciens), 10 images par seconde.
for z, n in (('0', 40), ('1', 40)):
    lists[5948].append({'name': f'marche-d-neuf-lisse-1366-z{z}', 'base': 'http://127.0.0.1:5948/', 'width': 1366, 'height': 768,
                        'steps': 10, 'dt': 0.1, 'frames': n, 'every': 1,
                        'q': {'temoins': 'marche', 'style': 'lisse', 'zoom': z, 'heure': '15:00', 'vue': '38.3,30.7'}})
for port, shots in lists.items():
    json.dump(shots, open(f'{sys.argv[1]}/prises2-{port}.json', 'w'), indent=1)
    print(port, len(shots))
