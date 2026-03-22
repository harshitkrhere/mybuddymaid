import re

css_path = r"c:\Users\Harshit\MyBuddyMaid\styles.css"
html_path = r"c:\Users\Harshit\MyBuddyMaid\index.html"

with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

# Update variables in :root
root_new = """:root {
  --teal-primary: #334155; /* Slate 700 */
  --teal-hover: #0F172A; /* Slate 900 */
  --teal-light: #F1F5F9; /* Slate 100 */
  --heading-dark: #020617; /* Slate 950 */
  --body-text: #475569; /* Slate 600 */
  --bg-white: #ffffff;
  --bg-offwhite: #F8FAFC; /* Slate 50 */
  --bg-gray: #F1F5F9; /* Slate 100 */
  --shadow-soft: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  --shadow-hover: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  --radius: 16px;
  --transition: all 0.3s ease;
}"""
css = re.sub(r':root\s*\{[^}]*\}', root_new, css, count=1)

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css)

# Update HTML inline colors 
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace("#008080", "#334155")
html = html.replace("rgba(0,128,128,0.1)", "rgba(51,65,85,0.1)")
html = html.replace("rgba(0,128,128,0.2)", "rgba(51,65,85,0.2)")
html = html.replace("rgba(0,128,128,0.3)", "rgba(51,65,85,0.3)")

# Add images
html = re.sub(
    r'<img src="[^"]+" alt="Premium cleaning service">',
    r'<img src="hero1.jpg" alt="Professional Maid and Chef">',
    html
)

html = re.sub(
    r'<div class="cta-bg-elements"></div>',
    r'<div class="cta-bg-elements" style="background: url(\'hero2.jpg\') center/cover; opacity: 0.2; position: absolute; top:0; left:0; right:0; bottom:0;"></div>',
    html
)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Applied Slate Palette and Images.")
