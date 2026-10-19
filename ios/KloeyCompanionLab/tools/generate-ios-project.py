"""Regenerate the native project while preserving the saved app signing teams."""
import json
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1] / 'app_swift'
project = ROOT / 'KloeyCompanionLab.xcodeproj/project.pbxproj'
teams = {}
if project.is_file():
    data = json.loads(subprocess.check_output(['plutil', '-convert', 'json', '-o', '-', str(project)]))
    objects = data['objects']
    defaults = objects[objects[data['rootObject']]['buildConfigurationList']]['buildConfigurations']
    for key in defaults:
        config = objects[key]
        team = config['buildSettings'].get('DEVELOPMENT_TEAM')
        if team:
            teams[config['name']] = team
    for target in objects.values():
        if target.get('isa') == 'PBXNativeTarget' and target.get('name') == 'KloeyCompanionLab':
            configurations = objects[target['buildConfigurationList']]['buildConfigurations']
            for key in configurations:
                config = objects[key]
                team = config['buildSettings'].get('DEVELOPMENT_TEAM', teams.get(config['name']))
                if team:
                    teams[config['name']] = team
if os.environ.get('TEAM_ID'):
    teams = {name: os.environ['TEAM_ID'] for name in ['Debug', 'Release']}
settings = {'name': 'KloeyCompanionLab', 'include': [str(ROOT / 'project.yml')],
            'settings': {'configs': {name: {'DEVELOPMENT_TEAM': team} for name, team in teams.items()}}}
(ROOT / 'build').mkdir(exist_ok=True)
with tempfile.NamedTemporaryFile(mode='w', suffix='.json', dir=ROOT / 'build') as overlay:
    json.dump(settings, overlay)
    overlay.flush()
    subprocess.run(['xcodegen', 'generate', '--spec', overlay.name,
                    '--project-root', str(ROOT), '--project', str(ROOT)], check=True)
