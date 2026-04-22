select column_name
from information_schema.columns
where table_name = 'boards'
order by ordinal_position;