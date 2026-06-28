import re
with open('backend/app/services/agent_assisted.py', 'r') as f:
    content = f.read()

# I will use ast to rewrite the logic or just regex replace
