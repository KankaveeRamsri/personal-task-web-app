select column_name
from information_schema.columns
where table_name = 'tasks'
order by ordinal_position;