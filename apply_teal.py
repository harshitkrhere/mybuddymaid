import re

css_path = r"c:\Users\Harshit\MyBuddyMaid\styles.css"
html_path = r"c:\Users\Harshit\MyBuddyMaid\index.html"

with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

# 1. Update font to Inter
css = css.replace("Plus Jakarta Sans", "Inter")

# 2. Update variables in :root
root_new = """:root {
  --teal-primary: #008080;
  --teal-hover: #00a896;
  --teal-light: #e6f2f2;
  --heading-dark: #111827;
  --body-text: #4b5563;
  --bg-white: #ffffff;
  --bg-offwhite: #f9fafb;
  --bg-gray: #f3f4f6;
  --shadow-soft: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  --shadow-hover: 0 10px 15px -3px rgba(0, 128, 128, 0.1), 0 4px 6px -2px rgba(0, 128, 128, 0.05);
  --radius: 16px;
  --transition: all 0.3s ease;
}"""
css = re.sub(r':root\s*\{[^}]*\}', root_new, css, count=1)

# 3. Replace usages of old CSS variables
css = css.replace("var(--orange-start)", "var(--teal-primary)")
css = css.replace("var(--orange-end)", "var(--teal-primary)") # MyUrbanMaid uses solid flat colors, not gradients typically, or simple gradients of similar teals. Let's use primary for both.
css = css.replace("var(--sage)", "var(--teal-hover)")
css = css.replace("var(--sage-light)", "var(--teal-light)")
css = css.replace("var(--trust-blue)", "var(--heading-dark)")
css = css.replace("var(--cream)", "var(--bg-gray)")
css = css.replace("var(--white)", "var(--bg-white)")
css = css.replace("var(--radius)", "16px") # Standardize

# Update button borders/radius
css = css.replace("border-radius:50px;", "border-radius:9999px;")
css = css.replace("border-radius:20px;", "border-radius:16px;")
css = css.replace("border-radius:24px;", "border-radius:16px;")
css = css.replace("border-radius:32px;", "border-radius:16px;")

# Fix specific color texts
css = css.replace("color: #334155;", "color: var(--body-text);")
css = css.replace("background: radial-gradient(circle at top right, #EEF2FF 0%, #F8FAFC 60%);", "background: var(--bg-offwhite);")
css = css.replace("border: 4px solid #fff;", "")
css = css.replace("box-shadow: 0 40px 80px -20px rgba(15, 23, 42, 0.2);", "box-shadow: var(--shadow-hover);")

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css)

# Update HTML inline colors and fonts
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace("Plus+Jakarta+Sans:wght@400;500;600;700;800", "Inter:wght@400;500;600;700;800")
html = html.replace("#4F46E5", "#008080")
html = html.replace("rgba(79,70,229,0.1)", "rgba(0,128,128,0.1)")
html = html.replace("rgba(79,70,229,0.2)", "rgba(0,128,128,0.2)")
html = html.replace("rgba(79,70,229,0.3)", "rgba(0,128,128,0.3)")

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Applied Teal Aesthetic.")
