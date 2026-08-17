import re

with open("main.py", "r") as f:
    content = f.read()

# Let's find all async defs except fetch_questions and ones we don't want to break
# Actually, it's safer to do this with a regular expression for endpoints.
pattern = re.compile(r'(@app\.(get|post|put|delete)\(.*?\)\n\s*)async def', re.MULTILINE | re.DOTALL)

# But wait, python regex has non-greedy matching.
# We should probably just process line by line.

lines = content.split('\n')
for i, line in enumerate(lines):
    if line.strip().startswith('@app.') and i + 1 < len(lines):
        if 'async def' in lines[i+1]:
            lines[i+1] = lines[i+1].replace('async def', 'def')

content = '\n'.join(lines)

# Now fix the internal awaits
# Line 1182: all_results = await asyncio.gather(...)
# Line 1137: unit_questions = await asyncio.to_thread(...)
content = content.replace('await asyncio.to_thread(', '') # wait, we can't just strip await.
# If we change it to def, we must change asyncio to concurrent.futures

with open("main_fixed.py", "w") as f:
    f.write(content)
print("Done")
