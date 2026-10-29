"""Preserve macOS extended attributes without AppleDouble temporary filenames.
Used after rsync copied file contents. Fails before deleting original data.
"""
import os
import sys
import ctypes
libc = ctypes.CDLL(None, use_errno=True)
libc.listxattr.argtypes = [ctypes.c_char_p, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_int]
libc.listxattr.restype = ctypes.c_ssize_t
libc.getxattr.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_uint32, ctypes.c_int]
libc.getxattr.restype = ctypes.c_ssize_t
libc.setxattr.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_uint32, ctypes.c_int]
libc.setxattr.restype = ctypes.c_int
def checked(result):
    if result < 0:
        code = ctypes.get_errno()
        raise OSError(code, os.strerror(code))
    return result
def list_attributes(file):
    length = checked(libc.listxattr(os.fsencode(file), None, 0, 1))
    if not length: return []
    buf = ctypes.create_string_buffer(length)
    length = checked(libc.listxattr(os.fsencode(file), buf, length, 1))
    return [name for name in buf.raw[:length].split(b'\0') if name]
def get_attribute(file, attribute):
    length = checked(libc.getxattr(os.fsencode(file), attribute, None, 0, 0, 1))
    buf = ctypes.create_string_buffer(max(length, 1))
    size = checked(libc.getxattr(os.fsencode(file), attribute, buf, length, 0, 1))
    return buf.raw[:size]
def set_attribute(file, attribute, content):
    checked(libc.setxattr(os.fsencode(file), attribute, content, len(content), 0, 1))
source, destination = sys.argv[1:3]
count = 0
errors = []
for current, directories, files in os.walk(source, followlinks=False):
    for name in ['.'] + directories + files:
        original = current if name == '.' else os.path.join(current, name)
        relative = os.path.relpath(original, source)
        copied = os.path.join(destination, relative)
        try:
            for attribute in list_attributes(original):
                content = get_attribute(original, attribute)
                try:
                    same = get_attribute(copied, attribute) == content
                except OSError:
                    same = False
                if not same:
                    set_attribute(copied, attribute, content)
                if get_attribute(copied, attribute) != content:
                    raise OSError('Extended attribute verification failed')
                count += 1
        except OSError as error:
            errors.append((relative, str(error)))
print(f'Verified {count} extended attributes; {len(errors)} errors', flush=True)
if errors:
    for entry in errors[:5]:
        print(entry, file=sys.stderr)
    sys.exit(1)
