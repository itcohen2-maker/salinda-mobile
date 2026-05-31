import sys
import re

def reverse_visual_hebrew(text):
    """
    Refined reversal for visual RTL in non-RTL terminals.
    Attempts to keep English words and numbers in their logical order
    while reversing the overall string and Hebrew characters.
    """
    # Split into chunks of Hebrew vs non-Hebrew
    # Hebrew range: \u0590-\u05FF
    chunks = re.split(r'([\u0590-\u05FF]+)', text)
    
    # This is a complex task for a simple script, 
    # but let's try a better approach: 
    # Just reverse the whole thing and then fix the numbers/English.
    
    reversed_text = text[::-1]
    
    # Fix numbers (they usually stay LTR)
    def fix_ltr_chunks(match):
        return match.group(0)[::-1]
    
    # Find sequences of English/Numbers/Punctuation that were reversed but shouldn't be
    # This regex is a simplification
    fixed = re.sub(r'([a-zA-Z0-9\s.,!?:;()\[\]{}]+)', fix_ltr_chunks, reversed_text)
    
    return fixed

if __name__ == "__main__":
    if len(sys.argv) > 1:
        text = " ".join(sys.argv[1:])
        print(reverse_visual_hebrew(text))
    else:
        for line in sys.stdin:
            line = line.strip()
            if line:
                print(reverse_visual_hebrew(line))
